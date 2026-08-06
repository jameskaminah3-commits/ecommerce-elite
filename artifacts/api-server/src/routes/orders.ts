import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, productVariantsTable, productsTable, deliveryLocationsTable, deliveryRatesTable } from "@workspace/db";
import { syncProductToSearchInBackground } from "../lib/meilisearch";
import {
  CreateOrderBody,
  ListOrdersQueryParams,
  GetOrderParams,
  UpdateOrderStatusBody,
  UpdateOrderStatusParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

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
    createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
    updatedAt: order.updatedAt instanceof Date ? order.updatedAt.toISOString() : order.updatedAt,
    items: items.map((i) => ({
      id: i.id,
      variantId: i.variantId,
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

router.get("/orders", async (req, res): Promise<void> => {
  const params = ListOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { status, page = 1, limit = 20 } = params.data;
  const conditions = status ? [eq(ordersTable.status, status)] : [];
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
    ? await db.select().from(orderItemsTable).where(
        orderIds.length === 1
          ? eq(orderItemsTable.orderId, orderIds[0])
          : sql`${orderItemsTable.orderId} = ANY(${orderIds})`
      )
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
  // purchases can gate product reviews. Anonymous checkout still works.
  const rawUserId = req.cookies?.userId;
  const userId = rawUserId && !Number.isNaN(parseInt(rawUserId, 10)) ? parseInt(rawUserId, 10) : null;

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

  // Apply the product's active promotional discount to the charged unit price.
  const unitPrice = (r: (typeof cartRows)[number]): number => {
    const pct = Math.min(Math.max(r.discountPercent ?? 0, 0), 90);
    return Math.round(parseFloat(r.price) * (1 - pct / 100) * 100) / 100;
  };

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

  const total = itemsTotal + deliveryFee;

  // Create order + items atomically
  const [order] = await db
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
      userId,
    })
    .returning();

  const itemsToInsert = cartRows.map((r) => ({
    orderId: order.id,
    variantId: r.variantId,
    productName: r.productName,
    productImageUrl: r.productImageUrl,
    variantSku: r.variantSku,
    variantSize: r.variantSize,
    variantColor: r.variantColor,
    price: String(unitPrice(r)),
    quantity: r.quantity,
    subtotal: String(unitPrice(r) * r.quantity),
  }));

  const items = await db.insert(orderItemsTable).values(itemsToInsert).returning();

  // Decrement inventory
  for (const row of cartRows) {
    await db
      .update(productVariantsTable)
      .set({ stock: row.stock - row.quantity })
      .where(eq(productVariantsTable.id, row.variantId));
    syncProductToSearchInBackground(row.productId);
  }

  // Clear cart
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));

  res.status(201).json(formatOrder(order, items));
});

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
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  res.json(formatOrder(order, items));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
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
