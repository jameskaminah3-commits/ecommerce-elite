import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  reviewsTable,
  usersTable,
  ordersTable,
  orderItemsTable,
  productVariantsTable,
  productsTable,
} from "@workspace/db";

const router: IRouter = Router();

function viewerId(req: any): number | null {
  const raw = req.cookies?.userId;
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

// Has this user bought (ordered) at least one variant of this product?
async function hasPurchased(userId: number, productId: number): Promise<boolean> {
  const rows = await db
    .select({ ok: sql<number>`1` })
    .from(ordersTable)
    .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .innerJoin(productVariantsTable, eq(productVariantsTable.id, orderItemsTable.variantId))
    .where(and(eq(ordersTable.userId, userId), eq(productVariantsTable.productId, productId)))
    .limit(1);
  return rows.length > 0;
}

async function recomputeProductRating(productId: number): Promise<{ average: number; count: number }> {
  const [{ avg, count }] = await db
    .select({
      avg: sql<string>`coalesce(avg(${reviewsTable.rating}), 0)`,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(reviewsTable)
    .where(eq(reviewsTable.productId, productId));
  const average = Math.round(Number(avg) * 100) / 100;
  await db
    .update(productsTable)
    .set({ rating: String(average), reviewCount: Number(count) })
    .where(eq(productsTable.id, productId));
  return { average, count: Number(count) };
}

// ── List reviews for a product (public), plus viewer eligibility ──────────
router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id, 10);
  if (Number.isNaN(productId)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const rows = await db
    .select({
      id: reviewsTable.id,
      rating: reviewsTable.rating,
      title: reviewsTable.title,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
      userName: usersTable.name,
      userId: reviewsTable.userId,
    })
    .from(reviewsTable)
    .innerJoin(usersTable, eq(usersTable.id, reviewsTable.userId))
    .where(eq(reviewsTable.productId, productId))
    .orderBy(desc(reviewsTable.createdAt));

  const count = rows.length;
  const average = count > 0 ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / count) * 100) / 100 : 0;

  const uid = viewerId(req);
  let authenticated = false;
  let purchased = false;
  let hasReviewed = false;
  if (uid != null) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    if (user) {
      authenticated = true;
      purchased = await hasPurchased(uid, productId);
      hasReviewed = rows.some((r) => r.userId === uid);
    }
  }

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      userName: r.userName,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    })),
    average,
    count,
    viewer: { authenticated, purchased, hasReviewed },
  });
});

// ── Create/update the viewer's review (must have purchased) ───────────────
router.post("/products/:id/reviews", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.id, 10);
  if (Number.isNaN(productId)) {
    res.status(400).json({ error: "Invalid product id" });
    return;
  }

  const uid = viewerId(req);
  if (uid == null) {
    res.status(401).json({ error: "Sign in to leave a review." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, uid));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be a whole number from 1 to 5." });
    return;
  }
  const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) || null : null;
  const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 2000) || null : null;

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (!(await hasPurchased(uid, productId))) {
    res.status(403).json({ error: "Only verified buyers can review this product." });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({ productId, userId: uid, rating, title, body })
    .onConflictDoUpdate({
      target: [reviewsTable.productId, reviewsTable.userId],
      set: { rating, title, body, updatedAt: new Date() },
    })
    .returning();

  const { average, count } = await recomputeProductRating(productId);

  res.status(201).json({
    review: {
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      userName: user.name,
      createdAt: review.createdAt instanceof Date ? review.createdAt.toISOString() : review.createdAt,
    },
    average,
    count,
  });
});

export default router;
