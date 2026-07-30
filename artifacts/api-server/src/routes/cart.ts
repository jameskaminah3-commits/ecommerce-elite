import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cartItemsTable, productVariantsTable, productsTable } from "@workspace/db";
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
    })
    .from(cartItemsTable)
    .innerJoin(productVariantsTable, eq(cartItemsTable.variantId, productVariantsTable.id))
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(cartItemsTable.sessionId, sessionId));

  const items = rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    productId: r.productId,
    productName: r.productName,
    productImageUrl: r.productImageUrl,
    variantSku: r.variantSku,
    variantSize: r.variantSize,
    variantColor: r.variantColor,
    price: parseFloat(r.price),
    quantity: r.quantity,
    subtotal: parseFloat(r.price) * r.quantity,
  }));

  return {
    items,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    total: items.reduce((s, i) => s + i.subtotal, 0),
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
