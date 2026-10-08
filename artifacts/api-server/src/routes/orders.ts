import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, sql, inArray, or, isNull } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, productVariantsTable, productsTable, deliveryLocationsTable, deliveryRatesTable, usersTable, siteSettingsTable } from "@workspace/db";
import { sendOrderReceivedEmail } from "../lib/email";
import { deductInventoryForOrder, reserveStockForOrder, InsufficientStockError } from "../lib/inventory";
import { findReferrerByCode } from "../lib/referral";
import { loadPricingPromos, effectiveDiscount, discountedPrice } from "../lib/pricing";
import { markOrderPaid } from "./payments";
import {
  CreateOrderBody,
  ListOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
} from "@workspace/api-zod";
import { requireAdmin, requireAuth, getUserId, type SessionUser } from "../middlewares/requireAdmin";
import { sessionCookieOptions } from "../lib/session";

const router: IRouter = Router();

// A guest checkout has no account, but the person who just placed the order
// must still be able to see their confirmation. We grant that by storing the
// order ids they created in a SIGNED, httpOnly cookie — unforgeable, so it
// exposes only the orders this browser actually created, never anyone else's.
const MAX_REMEMBERED_ORDERS = 25;

function rememberedOrderIds(req: Request): Set<number> {
  const raw = (req as Request & { signedCookies?: Record<string, string> }).signedCookies?.orderAccess;
  if (!raw) return new Set();
  return new Set(
    String(raw)
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n)),
  );
}

function grantOrderAccess(req: Request, res: import("express").Response, orderId: number): void {
  const ids = rememberedOrderIds(req);
  ids.add(orderId);
  const trimmed = Array.from(ids).slice(-MAX_REMEMBERED_ORDERS);
  res.cookie("orderAccess", trimmed.join(","), sessionCookieOptions());
}

function formatOrder(order: any, items: any[]) {
  return {
    id: order.id,
    status: order.status,
    total: parseFloat(order.total),
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    deliveryLocation: order.deliveryLocation ?? null,
    deliveryFee: order.deliveryFee != null ? parseFloat(order.deliveryFee) : 0,
    referralDiscount: order.referralDiscount != null ? parseFloat(order.referralDiscount) : 0,
    paymentReference: order.paymentReference ?? null,
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
    items: items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
      productId: i.productId ?? null,
      productName: i.productName,
      productImageUrl: i.productImageUrl,
      variantSku: i.variantSku,
      variantSize: i.variantSize,
      variantColor: i.variantColor,
      price: parseFloat(i.price),
      quantity: i.quantity,
      subtotal: parseFloat(i.subtotal),
    })),
  };
}

// Listing every order exposes customer PII and is admin-only.
// Admins see every order; a signed-in customer sees only their own. This is
// the order-history list behind the account page, so it must not be admin-only.
router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const viewer = (req as Request & { user?: SessionUser }).user;
  const { status, page = 1, limit = 20 } = params.data;
  const conditions = status ? [eq(ordersTable.status, status)] : [];
  // Non-admins are scoped to their own orders.
  if (viewer?.role !== "admin" && viewer) {
    conditions.push(eq(ordersTable.userId, viewer.id));
  }
  const offset = (page - 1) * limit;

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const orders = await db
    .select()
    .from(ordersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const orderIds = orders.map((o) => o.id);
  const allItems = orderIds.length > 0
    ? await db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds))
    : [];

  res.json({
    items: orders.map((o) => formatOrder(o, allItems.filter((i) => i.orderId === o.id))),
    total: count,
    page,
    limit,
  });
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get cart from session
  const sessionId = req.cookies?.cartSession;
  if (!sessionId) {
    res.status(400).json({ error: "No cart session found" });
    return;
  }

  // Attribute the order to the logged-in user when there is one, so verified
  // purchases can gate product reviews. Anonymous checkout still works. The id
  // comes from the signed cookie, so it can't be forged to another user.
  const userId = getUserId(req);

  const cartRows = await db
    .select({
      id: cartItemsTable.id,
      variantId: cartItemsTable.variantId,
      quantity: cartItemsTable.quantity,
      productId: productsTable.id,
      productName: productsTable.name,
      productImageUrl: productsTable.imageUrl,
      variantSku: productVariantsTable.sku,
      variantSize: productVariantsTable.size,
      variantColor: productVariantsTable.color,
      price: productVariantsTable.price,
      categoryId: productsTable.categoryId,
      discountPercent: productsTable.discountPercent,
      deliveryClassId: productsTable.deliveryClassId,
      stock: productVariantsTable.stock,
    })
    .from(cartItemsTable)
    .innerJoin(productVariantsTable, eq(cartItemsTable.variantId, productVariantsTable.id))
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.sessionId, sessionId));

  if (cartRows.length === 0) {
    res.status(400).json({ error: "Cart is empty" });
    return;
  }

  // Check stock
  for (const item of cartRows) {
    if (item.stock < item.quantity) {
      res.status(400).json({ error: `Insufficient stock for ${item.productName}` });
      return;
    }
  }

  // Price each line with the discount that applies RIGHT NOW (the product's Offer
  // or a live promotion, whichever is bigger) - read fresh, so a campaign that has
  // just ended can never be charged at its old price.
  const promos = await loadPricingPromos();
  const unitPrice = (r: (typeof cartRows)[number]): number =>
    discountedPrice(
      parseFloat(r.price),
      effectiveDiscount({ id: r.productId, categoryId: r.categoryId, discountPercent: r.discountPercent }, promos).percent,
    );

  const itemsTotal = cartRows.reduce((s, r) => s + unitPrice(r) * r.quantity, 0);

  // Resolve delivery cost server-side from the chosen town — never trust a
  // client-supplied fee.
  let deliveryLocationName: string | null = null;
  let deliveryFee = 0;
  if (parsed.data.deliveryLocationId != null) {
    const [loc] = await db
      .select()
      .from(deliveryLocationsTable)
      .where(eq(deliveryLocationsTable.id, parsed.data.deliveryLocationId));
    if (!loc || !loc.active) {
      res.status(400).json({ error: "Selected delivery location is unavailable." });
      return;
    }
    deliveryLocationName = loc.name;

    const baseCost = parseFloat(loc.cost);
    const rateRows = await db
      .select()
      .from(deliveryRatesTable)
      .where(eq(deliveryRatesTable.locationId, loc.id));
    const rateByClass = new Map<number, number>();
    for (const r of rateRows) rateByClass.set(r.classId, parseFloat(r.cost));

    // Highest applicable class cost across the cart; a product with no class
    // (or no rate for this town) uses the town's base cost.
    deliveryFee = baseCost;
    for (const row of cartRows) {
      const itemCost =
        row.deliveryClassId != null && rateByClass.has(row.deliveryClassId)
          ? (rateByClass.get(row.deliveryClassId) as number)
          : baseCost;
      if (itemCost > deliveryFee) deliveryFee = itemCost;
    }
  }

  // Referral promotion: a valid code from a *different* customer gives the
  // buyer a discount on their first order. The code arrives in the `ref` cookie
  // (dropped by the storefront when a share link is opened).
  let referralDiscount = 0;
  let referralCodeUsed: string | null = null;
  let referrerId: number | null = null;
  const refCode = typeof req.cookies?.ref === "string" ? req.cookies.ref : "";
  if (refCode) {
    const [settings] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
    const pct = settings?.referralEnabled ? Math.min(Math.max(settings.referralDiscountPercent ?? 0, 0), 90) : 0;
    if (pct > 0) {
      const referrer = await findReferrerByCode(refCode);
      const buyerEmail = parsed.data.customerEmail?.trim().toLowerCase() || null;
      // A customer can't refer themselves.
      const isSelf = referrer != null && (referrer.id === userId || (buyerEmail != null && referrer.email.toLowerCase() === buyerEmail));
      if (referrer && !isSelf) {
        // The discount is for first-time buyers only: no prior order under this
        // account or this email.
        const priorConds = [] as any[];
        if (userId != null) priorConds.push(eq(ordersTable.userId, userId));
        if (buyerEmail != null) priorConds.push(sql`lower(${ordersTable.customerEmail}) = ${buyerEmail}`);
        const priorCount = priorConds.length
          ? (await db.select({ c: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(or(...priorConds)))[0]?.c ?? 0
          : 0;
        if (priorCount === 0) {
          referralDiscount = Math.round(itemsTotal * (pct / 100) * 100) / 100;
          referralCodeUsed = referrer.referralCode;
          referrerId = referrer.id;
        }
      }
    }
  }

  const total = Math.max(0, Math.round((itemsTotal + deliveryFee - referralDiscount) * 100) / 100);

  // Create the order, its line items, and stock holds atomically. Reserving
  // inside the same transaction means a concurrent checkout for the last unit
  // fails cleanly rather than overselling; the hold auto-expires if payment
  // never completes (see reservationTtlMs).
  let order: typeof ordersTable.$inferSelect;
  let items: (typeof orderItemsTable.$inferSelect)[];
  try {
    const created = await db.transaction(async (tx) => {
      const [ord] = await tx
        .insert(ordersTable)
        .values({
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          customerPhone: parsed.data.customerPhone,
          shippingAddress: parsed.data.shippingAddress,
          paymentMethod: parsed.data.paymentMethod as any,
          total: String(total),
          status: "pending",
          paymentStatus: "pending",
          deliveryLocation: deliveryLocationName,
          deliveryFee: String(deliveryFee),
          referralDiscount: String(referralDiscount),
          referralCodeUsed,
          userId,
        })
        .returning();

      const its = await tx
        .insert(orderItemsTable)
        .values(
          cartRows.map((r) => ({
            orderId: ord.id,
            variantId: r.variantId,
            productName: r.productName,
            productImageUrl: r.productImageUrl,
            variantSku: r.variantSku,
            variantSize: r.variantSize,
            variantColor: r.variantColor,
            price: String(unitPrice(r)),
            quantity: r.quantity,
            subtotal: String(unitPrice(r) * r.quantity),
          })),
        )
        .returning();

      await reserveStockForOrder(
        tx,
        ord.id,
        cartRows.map((r) => ({ variantId: r.variantId, quantity: r.quantity, productName: r.productName })),
      );

      return { ord, its };
    });
    order = created.ord;
    items = created.its;
  } catch (err) {
    if (err instanceof InsufficientStockError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }

  // Reserve stock now only for cash-on-delivery, which has no online payment
  // step to gate on. M-Pesa/Paystack orders deduct stock on payment
  // confirmation instead (see markOrderPaid), so an abandoned payment doesn't
  // hold inventory. The early stock check above still gives immediate feedback.
  if (order.paymentMethod === "cash_on_delivery") {
    await deductInventoryForOrder(order.id);
  }

  // Clear cart
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));

  // Email the customer an order-received confirmation (fire-and-forget so a
  // slow/absent email provider never blocks checkout).
  if (order.customerEmail) {
    void sendOrderReceivedEmail(order.customerEmail, {
      orderId: order.id,
      customerName: order.customerName,
      total: parseFloat(order.total),
      deliveryFee: parseFloat(order.deliveryFee ?? "0"),
      deliveryLocation: order.deliveryLocation,
      items: items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        subtotal: parseFloat(i.subtotal),
      })),
    }).catch(() => {});
  }

  // Let this browser view the order it just created, even as a guest.
  grantOrderAccess(req, res, order.id);

  // Permanently attribute a logged-in buyer to their referrer (first time only).
  if (referrerId != null && userId != null) {
    await db
      .update(usersTable)
      .set({ referredByUserId: referrerId })
      .where(and(eq(usersTable.id, userId), isNull(usersTable.referredByUserId)));
  }

  res.status(201).json(formatOrder(order, items));
});

// An order carries customer PII, so it is readable only by: an admin, the
// logged-in user who owns it, or the guest browser that created it (proven by
// the signed orderAccess cookie). No blanket login requirement, so guest
// checkout can still show a confirmation page.
router.get("/orders/:id", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const userId = getUserId(req);
  let viewer: SessionUser | null = null;
  if (userId != null) {
    [viewer] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  }
  const isOwner = order.userId != null && viewer?.id === order.userId;
  const isGuestCreator = rememberedOrderIds(req).has(order.id);
  if (!isOwner && !isGuestCreator && viewer?.role !== "admin") {
    res.status(403).json({ error: "You do not have access to this order." });
    return;
  }
  const rawItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  // Resolve each line's product so the confirmation page can link to it (e.g.
  // "Rate this product" once the order is paid).
  const variantIds = rawItems.map((i) => i.variantId);
  const variantRows = variantIds.length
    ? await db
        .select({ id: productVariantsTable.id, productId: productVariantsTable.productId })
        .from(productVariantsTable)
        .where(inArray(productVariantsTable.id, variantIds))
    : [];
  const productByVariant = new Map(variantRows.map((v) => [v.id, v.productId]));
  const items = rawItems.map((i) => ({ ...i, productId: productByVariant.get(i.variantId) ?? null }));
  res.json(formatOrder(order, items));
});

// The customer (owner or guest creator) submits the M-Pesa confirmation code
// after paying manually to the Paybill/Till (the STK fallback). The order stays
// pending until an admin verifies the code and marks it paid.
router.post("/orders/:id/payment-reference", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const userId = getUserId(req);
  let viewer: SessionUser | null = null;
  if (userId != null) {
    [viewer] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  }
  const isOwner = order.userId != null && viewer?.id === order.userId;
  const isGuestCreator = rememberedOrderIds(req).has(order.id);
  if (!isOwner && !isGuestCreator && viewer?.role !== "admin") {
    res.status(403).json({ error: "You do not have access to this order." });
    return;
  }
  const reference = String(req.body?.reference ?? "").trim().slice(0, 120);
  if (!reference) {
    res.status(400).json({ error: "Enter the M-Pesa confirmation code." });
    return;
  }
  const [updated] = await db
    .update(ordersTable)
    .set({ paymentReference: reference, paymentMethod: order.paymentMethod ?? "mpesa" })
    .where(eq(ordersTable.id, order.id))
    .returning();
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(updated, items));
});

// Admin: confirm a manually-paid order (e.g. after checking the M-Pesa code
// against the till statement). Marks it paid + confirmed and deducts stock.
router.post("/orders/:id/mark-paid", requireAdmin, async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  await markOrderPaid(order);
  const [fresh] = await db.select().from(ordersTable).where(eq(ordersTable.id, order.id));
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(fresh, items));
});

router.patch("/orders/:id/status", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateOrderStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db
    .update(ordersTable)
    .set({ status: parsed.data.status })
    .where(eq(ordersTable.id, params.data.id))
    .returning();
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

export default router;
