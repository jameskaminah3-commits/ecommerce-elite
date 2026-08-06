import { Router, type IRouter } from "express";
import { eq, ilike, gte, lte, and, desc, asc, sql, inArray } from "drizzle-orm";
import { db, productsTable, productVariantsTable, categoriesTable } from "@workspace/db";
import {
  deleteProductFromSearchInBackground,
  searchProductIds,
  syncProductToSearchInBackground,
} from "../lib/meilisearch";
import {
  ListProductsQueryParams,
  CreateProductBody,
  UpdateProductBody,
  UpdateProductParams,
  GetProductParams,
  DeleteProductParams,
  ListProductVariantsParams,
  CreateProductVariantBody,
  CreateProductVariantParams,
  UpdateVariantBody,
  UpdateVariantParams,
  DeleteVariantParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function productRow(p: any, categoryName: string | null, totalStock: number) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    basePrice: parseFloat(p.basePrice),
    compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
    categoryId: p.categoryId,
    categoryName,
    imageUrl: p.imageUrl,
    images: p.images ?? [],
    status: p.status,
    featured: p.featured,
    discountPercent: p.discountPercent ?? 0,
    deliveryClassId: p.deliveryClassId ?? null,
    totalStock,
    rating: p.rating ? parseFloat(p.rating) : null,
    reviewCount: p.reviewCount,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
  };
}

router.get("/products", async (req, res): Promise<void> => {
  const params = ListProductsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { category, minPrice, maxPrice, search, sort, page = 1, limit = 24, featured } = params.data;

  const searchResult = search
    ? await searchProductIds({ query: search, page, limit, category, minPrice, maxPrice, featured, sort })
    : null;

  if (searchResult && searchResult.ids.length === 0) {
    res.json({ items: [], total: 0, page, limit });
    return;
  }

  const conditions = [];
  if (category) conditions.push(eq(productsTable.categoryId, category));
  if (minPrice != null) conditions.push(gte(productsTable.basePrice, String(minPrice)));
  if (maxPrice != null) conditions.push(lte(productsTable.basePrice, String(maxPrice)));
  if (searchResult) conditions.push(inArray(productsTable.id, searchResult.ids));
  if (search && !searchResult) conditions.push(ilike(productsTable.name, `%${search}%`));
  if (featured != null) conditions.push(eq(productsTable.featured, featured));
  // Only show active products in storefront by default
  conditions.push(eq(productsTable.status, "active"));

  let orderBy;
  switch (sort) {
    case "price_asc": orderBy = asc(productsTable.basePrice); break;
    case "price_desc": orderBy = desc(productsTable.basePrice); break;
    case "popular": orderBy = desc(productsTable.reviewCount); break;
    default: orderBy = desc(productsTable.createdAt);
  }

  const offset = (page - 1) * limit;

  const [{ count }] = searchResult
    ? [{ count: searchResult.total }]
    : await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(productsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

  const finalOrderBy = searchResult
    ? sql.raw(`array_position(ARRAY[${searchResult.ids.join(",")}], products.id)`)
    : orderBy;

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      totalStock: sql<number>`cast(coalesce(sum(${productVariantsTable.stock}), 0) as int)`,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productVariantsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(productsTable.id, categoriesTable.name)
    .orderBy(finalOrderBy)
    .limit(limit)
    .offset(searchResult ? 0 : offset);

  res.json({
    items: rows.map((r) => productRow(r.product, r.categoryName ?? null, r.totalStock ?? 0)),
    total: count,
    page,
    limit,
  });
});

router.post("/products", async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: any = { ...parsed.data };
  if (data.basePrice != null) data.basePrice = String(data.basePrice);
  if (data.compareAtPrice != null) data.compareAtPrice = String(data.compareAtPrice);
  const [prod] = await db.insert(productsTable).values(data).returning();
  const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, prod.categoryId));
  syncProductToSearchInBackground(prod.id);
  res.status(201).json(productRow(prod, cat?.name ?? null, 0));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      totalStock: sql<number>`cast(coalesce(sum(${productVariantsTable.stock}), 0) as int)`,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productVariantsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(productsTable.id, params.data.id))
    .groupBy(productsTable.id, categoriesTable.name);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const variants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, params.data.id))
    .orderBy(productVariantsTable.createdAt);

  res.json({
    ...productRow(row.product, row.categoryName ?? null, row.totalStock ?? 0),
    variants: variants.map((v) => ({
      ...v,
      price: parseFloat(v.price),
      createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt,
    })),
  });
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: any = { ...parsed.data };
  if (data.basePrice != null) data.basePrice = String(data.basePrice);
  if (data.compareAtPrice != null) data.compareAtPrice = String(data.compareAtPrice);
  const [prod] = await db.update(productsTable).set(data).where(eq(productsTable.id, params.data.id)).returning();
  if (!prod) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, prod.categoryId));
  syncProductToSearchInBackground(prod.id);
  res.json(productRow(prod, cat?.name ?? null, 0));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  deleteProductFromSearchInBackground(params.data.id);
  res.sendStatus(204);
});

// ── VARIANTS ──────────────────────────────────────────────────────────────
router.get("/products/:id/variants", async (req, res): Promise<void> => {
  const params = ListProductVariantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const variants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, params.data.id))
    .orderBy(productVariantsTable.createdAt);
  res.json(variants.map((v) => ({ ...v, price: parseFloat(v.price), createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : v.createdAt })));
});

router.post("/products/:id/variants", async (req, res): Promise<void> => {
  const params = CreateProductVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateProductVariantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: any = { ...parsed.data, productId: params.data.id };
  data.price = String(data.price);
  const [variant] = await db.insert(productVariantsTable).values(data).returning();
  syncProductToSearchInBackground(params.data.id);
  res.status(201).json({ ...variant, price: parseFloat(variant.price), createdAt: variant.createdAt instanceof Date ? variant.createdAt.toISOString() : variant.createdAt });
});

router.patch("/variants/:id", async (req, res): Promise<void> => {
  const params = UpdateVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateVariantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data: any = { ...parsed.data };
  if (data.price != null) data.price = String(data.price);
  const [variant] = await db.update(productVariantsTable).set(data).where(eq(productVariantsTable.id, params.data.id)).returning();
  if (!variant) {
    res.status(404).json({ error: "Variant not found" });
    return;
  }
  syncProductToSearchInBackground(variant.productId);
  res.json({ ...variant, price: parseFloat(variant.price), createdAt: variant.createdAt instanceof Date ? variant.createdAt.toISOString() : variant.createdAt });
});

router.delete("/variants/:id", async (req, res): Promise<void> => {
  const params = DeleteVariantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, params.data.id));
  await db.delete(productVariantsTable).where(eq(productVariantsTable.id, params.data.id));
  if (variant) syncProductToSearchInBackground(variant.productId);
  res.sendStatus(204);
});

export default router;
