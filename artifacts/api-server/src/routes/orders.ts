import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, productVariantsTable, productsTable } from "@workspace/db";
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

  const total = cartRows.reduce((s, r) => s + parseFloat(r.price) * r.quantity, 0);

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
    price: r.price,
    quantity: r.quantity,
    subtotal: String(parseFloat(r.price) * r.quantity),
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
