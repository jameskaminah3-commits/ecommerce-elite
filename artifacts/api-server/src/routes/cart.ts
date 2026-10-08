import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartItemsTable, productVariantsTable, productsTable } from "@workspace/db";
import { loadPricingPromos, effectiveDiscount, discountedPrice } from "../lib/pricing";
import {
  AddCartItemBody,
  UpdateCartItemBody,
  UpdateCartItemParams,
  RemoveCartItemParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function getSessionId(req: any): string {
  if (!req.cookies?.cartSession) {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return id;
  }
  return req.cookies.cartSession;
}

async function buildCart(sessionId: string) {
  const rows = await db
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
      compareAtPrice: productsTable.compareAtPrice,
    })
    .from(cartItemsTable)
    .innerJoin(productVariantsTable, eq(cartItemsTable.variantId, productVariantsTable.id))
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.sessionId, sessionId));

  // Offers and any live promotion, resolved the same way as the listing and checkout.
  const promos = await loadPricingPromos();

  const items = rows.map((r) => {
    // Charge the discounted unit price so the cart matches what checkout bills.
    const pct = effectiveDiscount({ id: r.productId, categoryId: r.categoryId, discountPercent: r.discountPercent }, promos).percent;
    const list = parseFloat(r.price);
    const price = discountedPrice(list, pct);
    // The "typical retail price" the shopper is comparing against — same rule
    // the product page uses: an active promo is measured against the list price,
    // otherwise against the admin-set compare-at (retail) price when it's higher.
    const compareAt = r.compareAtPrice != null ? parseFloat(r.compareAtPrice) : null;
    const retailPrice = pct > 0 ? list : compareAt != null && compareAt > list ? compareAt : null;
    return {
      id: r.id,
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      productImageUrl: r.productImageUrl,
      variantSku: r.variantSku,
      variantSize: r.variantSize,
      variantColor: r.variantColor,
      price,
      retailPrice,
      quantity: r.quantity,
      subtotal: price * r.quantity,
    };
  });

  // How much cheaper the cart is than buying the same things at retail.
  const savings = items.reduce(
    (s, i) => s + (i.retailPrice != null && i.retailPrice > i.price ? (i.retailPrice - i.price) * i.quantity : 0),
    0,
  );

  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.subtotal, 0),
    savings: Math.round(savings * 100) / 100,
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req);
  res.cookie("cartSession", sessionId, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const parsed = AddCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sessionId = getSessionId(req);
  res.cookie("cartSession", sessionId, { httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });

  // Check variant exists
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, parsed.data.variantId));
  if (!variant) {
    res.status(404).json({ error: "Variant not found" });
    return;
  }

  // Upsert cart item
  const [existing] = await db
    .select()
    .from(cartItemsTable)
    .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.variantId, parsed.data.variantId)));

  if (existing) {
    await db
      .update(cartItemsTable)
      .set({ quantity: existing.quantity + parsed.data.quantity })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({
      sessionId,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    });
  }

  const cart = await buildCart(sessionId);
  res.status(201).json(cart);
});

router.patch("/cart/items/:id", async (req, res): Promise<void> => {
  const params = UpdateCartItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sessionId = getSessionId(req);
  await db
    .update(cartItemsTable)
    .set({ quantity: parsed.data.quantity })
    .where(and(eq(cartItemsTable.id, params.data.id), eq(cartItemsTable.sessionId, sessionId)));
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.delete("/cart/items/:id", async (req, res): Promise<void> => {
  const params = RemoveCartItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionId = getSessionId(req);
  await db
    .delete(cartItemsTable)
    .where(and(eq(cartItemsTable.id, params.data.id), eq(cartItemsTable.sessionId, sessionId)));
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.delete("/cart", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  res.sendStatus(204);
});

export default router;
