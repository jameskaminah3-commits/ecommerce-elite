import { Router, type IRouter } from "express";
import { eq, gte, desc, sql, lte } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, productVariantsTable, usersTable, categoriesTable } from "@workspace/db";
import {
  GetAnalyticsSalesQueryParams,
  GetTopProductsQueryParams,
  GetLowStockVariantsQueryParams,
  GetRecentOrdersQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/analytics/overview", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ totalOrders }] = await db.select({ totalOrders: sql<number>`cast(count(*) as int)` }).from(ordersTable);
  const [{ totalRevenue }] = await db.select({ totalRevenue: sql<number>`cast(coalesce(sum(total), 0) as float)` }).from(ordersTable).where(eq(ordersTable.paymentStatus, "paid"));
  const [{ totalProducts }] = await db.select({ totalProducts: sql<number>`cast(count(*) as int)` }).from(productsTable);
  const [{ totalCustomers }] = await db.select({ totalCustomers: sql<number>`cast(count(*) as int)` }).from(usersTable).where(eq(usersTable.role, "customer"));
  const [{ pendingOrders }] = await db.select({ pendingOrders: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [{ lowStockCount }] = await db.select({ lowStockCount: sql<number>`cast(count(*) as int)` }).from(productVariantsTable).where(lte(productVariantsTable.stock, 5));
  const [{ revenueThisMonth }] = await db.select({ revenueThisMonth: sql<number>`cast(coalesce(sum(total), 0) as float)` }).from(ordersTable).where(gte(ordersTable.createdAt, startOfMonth));
  const [{ ordersThisMonth }] = await db.select({ ordersThisMonth: sql<number>`cast(count(*) as int)` }).from(ordersTable).where(gte(ordersTable.createdAt, startOfMonth));

  res.json({
    totalOrders,
    totalRevenue,
    totalProducts,
    totalCustomers,
    pendingOrders,
    lowStockCount,
    revenueThisMonth,
    ordersThisMonth,
  });
});

router.get("/admin/analytics/sales", async (req, res): Promise<void> => {
  const params = GetAnalyticsSalesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const days = params.data.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${ordersTable.createdAt}), 'YYYY-MM-DD')`,
      orders: sql<number>`cast(count(*) as int)`,
      revenue: sql<number>`cast(coalesce(sum(${ordersTable.total}), 0) as float)`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, since))
    .groupBy(sql`date_trunc('day', ${ordersTable.createdAt})`)
    .orderBy(sql`date_trunc('day', ${ordersTable.createdAt})`);

  res.json(rows);
});

router.get("/admin/analytics/top-products", async (req, res): Promise<void> => {
  const params = GetTopProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const limit = params.data.limit ?? 10;

  const rows = await db
    .select({
      id: productsTable.id,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
      totalSold: sql<number>`cast(sum(${orderItemsTable.quantity}) as int)`,
      revenue: sql<number>`cast(sum(${orderItemsTable.subtotal}) as float)`,
    })
    .from(orderItemsTable)
    .innerJoin(productVariantsTable, eq(orderItemsTable.variantId, productVariantsTable.id))
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .groupBy(productsTable.id, productsTable.name, productsTable.imageUrl)
    .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
    .limit(limit);

  res.json(rows);
});

router.get("/admin/inventory/low-stock", async (req, res): Promise<void> => {
  const params = GetLowStockVariantsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const threshold = params.data.threshold ?? 5;

  const rows = await db
    .select({
      id: productVariantsTable.id,
      productId: productsTable.id,
      productName: productsTable.name,
      sku: productVariantsTable.sku,
      size: productVariantsTable.size,
      color: productVariantsTable.color,
      stock: productVariantsTable.stock,
      price: productVariantsTable.price,
    })
    .from(productVariantsTable)
    .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(lte(productVariantsTable.stock, threshold))
    .orderBy(productVariantsTable.stock);

  res.json(rows.map((r) => ({ ...r, price: parseFloat(r.price) })));
});

router.get("/admin/orders/recent", async (req, res): Promise<void> => {
  const params = GetRecentOrdersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const limit = params.data.limit ?? 10;

  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const allItems = orders.length > 0
    ? await db.select().from(orderItemsTable).where(
        sql`${orderItemsTable.orderId} = ANY(${orders.map((o) => o.id)})`
      )
    : [];

  res.json(
    orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: parseFloat(o.total),
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
      updatedAt: o.updatedAt instanceof Date ? o.updatedAt.toISOString() : o.updatedAt,
      items: allItems.filter((i) => i.orderId === o.id).map((i) => ({
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
    }))
  );
});

export default router;
