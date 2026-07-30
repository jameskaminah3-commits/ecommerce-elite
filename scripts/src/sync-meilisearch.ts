import { asc, eq, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  pool,
  productVariantsTable,
  productsTable,
} from "@workspace/db";

const host = process.env.MEILISEARCH_HOST ?? process.env.MEILI_HOST;
const apiKey = process.env.MEILISEARCH_API_KEY ?? process.env.MEILI_MASTER_KEY;
const indexName = process.env.MEILISEARCH_PRODUCTS_INDEX ?? "products";

if (!host || !apiKey) {
  throw new Error("Set MEILISEARCH_HOST and MEILISEARCH_API_KEY before syncing.");
}

const meilisearchHost = host.replace(/\/+$/, "");

async function meiliRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${meilisearchHost}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Meilisearch ${response.status}: ${await response.text()}`);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

async function configureIndex(): Promise<void> {
  await meiliRequest(`/indexes/${indexName}`).catch(async () => {
    await meiliRequest(`/indexes`, {
      method: "POST",
      body: JSON.stringify({ uid: indexName, primaryKey: "id" }),
    });
  });

  await meiliRequest(`/indexes/${indexName}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["name", "slug", "description", "categoryName", "skus", "variantOptions"],
      filterableAttributes: ["status", "categoryId", "featured", "basePrice"],
      sortableAttributes: ["basePrice", "createdAt", "reviewCount"],
      displayedAttributes: ["id"],
    }),
  });
}

async function main(): Promise<void> {
  await configureIndex();

  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      totalStock: sql<number>`cast(coalesce(sum(${productVariantsTable.stock}), 0) as int)`,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productVariantsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(productsTable.status, "active"))
    .groupBy(productsTable.id, categoriesTable.name)
    .orderBy(asc(productsTable.id));

  const documents = [];

  for (const row of rows) {
    const variants = await db
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.productId, row.product.id))
      .orderBy(asc(productVariantsTable.createdAt));

    documents.push({
      id: row.product.id,
      name: row.product.name,
      slug: row.product.slug,
      description: row.product.description,
      basePrice: Number(row.product.basePrice),
      compareAtPrice: row.product.compareAtPrice == null ? null : Number(row.product.compareAtPrice),
      categoryId: row.product.categoryId,
      categoryName: row.categoryName ?? null,
      imageUrl: row.product.imageUrl,
      images: row.product.images ?? [],
      status: row.product.status,
      featured: row.product.featured,
      rating: row.product.rating == null ? null : Number(row.product.rating),
      reviewCount: row.product.reviewCount,
      totalStock: row.totalStock ?? 0,
      skus: variants.map((variant) => variant.sku),
      variantOptions: variants.flatMap((variant) => [variant.size, variant.color, variant.material].filter(Boolean) as string[]),
      createdAt: row.product.createdAt instanceof Date ? row.product.createdAt.toISOString() : String(row.product.createdAt),
    });
  }

  await meiliRequest(`/indexes/${indexName}/documents`, {
    method: "POST",
    body: JSON.stringify(documents),
  });

  console.log(`Queued ${documents.length} products for Meilisearch index "${indexName}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
