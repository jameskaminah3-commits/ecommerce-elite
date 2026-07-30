import { asc, eq, sql } from "drizzle-orm";
import {
  categoriesTable,
  db,
  productVariantsTable,
  productsTable,
} from "@workspace/db";
import { logger } from "./logger";

const host = process.env.MEILISEARCH_HOST ?? process.env.MEILI_HOST;
const apiKey = process.env.MEILISEARCH_API_KEY ?? process.env.MEILI_MASTER_KEY;
const productsIndex = process.env.MEILISEARCH_PRODUCTS_INDEX ?? "products";

type SearchSort = "newest" | "price_asc" | "price_desc" | "popular" | undefined;

export type ProductSearchOptions = {
  query: string;
  page: number;
  limit: number;
  category?: number;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  sort?: SearchSort;
};

export type ProductSearchResult = {
  ids: number[];
  total: number;
};

type ProductDocument = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  categoryId: number;
  categoryName: string | null;
  imageUrl: string | null;
  images: string[];
  status: string;
  featured: boolean;
  rating: number | null;
  reviewCount: number;
  totalStock: number;
  skus: string[];
  variantOptions: string[];
  createdAt: string;
};

export function isMeilisearchConfigured(): boolean {
  return Boolean(host && apiKey);
}

function baseUrl(): string {
  if (!host) {
    throw new Error("MEILISEARCH_HOST is not configured");
  }

  return host.replace(/\/+$/, "");
}

async function meiliRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiKey) {
    throw new Error("MEILISEARCH_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Meilisearch ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function sortForMeili(sort: SearchSort): string[] | undefined {
  switch (sort) {
    case "price_asc":
      return ["basePrice:asc"];
    case "price_desc":
      return ["basePrice:desc"];
    case "popular":
      return ["reviewCount:desc"];
    case "newest":
    default:
      return ["createdAt:desc"];
  }
}

function filtersForMeili(options: ProductSearchOptions): string[] {
  const filters = ["status = active"];

  if (options.category != null) filters.push(`categoryId = ${options.category}`);
  if (options.minPrice != null) filters.push(`basePrice >= ${options.minPrice}`);
  if (options.maxPrice != null) filters.push(`basePrice <= ${options.maxPrice}`);
  if (options.featured != null) filters.push(`featured = ${options.featured}`);

  return filters;
}

export async function searchProductIds(options: ProductSearchOptions): Promise<ProductSearchResult | null> {
  if (!isMeilisearchConfigured()) return null;

  const offset = (options.page - 1) * options.limit;

  try {
    const result = await meiliRequest<{
      hits: Array<{ id: number | string }>;
      estimatedTotalHits?: number;
      totalHits?: number;
    }>(`/indexes/${productsIndex}/search`, {
      method: "POST",
      body: JSON.stringify({
        q: options.query,
        limit: options.limit,
        offset,
        filter: filtersForMeili(options),
        sort: sortForMeili(options.sort),
      }),
    });

    return {
      ids: result.hits.map((hit) => Number(hit.id)).filter(Number.isInteger),
      total: result.estimatedTotalHits ?? result.totalHits ?? result.hits.length,
    };
  } catch (err) {
    logger.warn({ err }, "Meilisearch query failed; falling back to Postgres search");
    return null;
  }
}

export async function configureProductSearchIndex(): Promise<void> {
  if (!isMeilisearchConfigured()) return;

  await meiliRequest(`/indexes/${productsIndex}`).catch(async () => {
    await meiliRequest(`/indexes`, {
      method: "POST",
      body: JSON.stringify({ uid: productsIndex, primaryKey: "id" }),
    });
  });

  await meiliRequest(`/indexes/${productsIndex}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["name", "slug", "description", "categoryName", "skus", "variantOptions"],
      filterableAttributes: ["status", "categoryId", "featured", "basePrice"],
      sortableAttributes: ["basePrice", "createdAt", "reviewCount"],
      displayedAttributes: ["id"],
    }),
  });
}

export async function buildProductSearchDocument(productId: number): Promise<ProductDocument | null> {
  const [row] = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
      totalStock: sql<number>`cast(coalesce(sum(${productVariantsTable.stock}), 0) as int)`,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(productVariantsTable, eq(productVariantsTable.productId, productsTable.id))
    .where(eq(productsTable.id, productId))
    .groupBy(productsTable.id, categoriesTable.name);

  if (!row) return null;

  const variants = await db
    .select()
    .from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId))
    .orderBy(asc(productVariantsTable.createdAt));

  const product = row.product;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    basePrice: Number(product.basePrice),
    compareAtPrice: product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    categoryId: product.categoryId,
    categoryName: row.categoryName ?? null,
    imageUrl: product.imageUrl,
    images: product.images ?? [],
    status: product.status,
    featured: product.featured,
    rating: product.rating == null ? null : Number(product.rating),
    reviewCount: product.reviewCount,
    totalStock: row.totalStock ?? 0,
    skus: variants.map((variant) => variant.sku),
    variantOptions: variants.flatMap((variant) => [variant.size, variant.color, variant.material].filter(Boolean) as string[]),
    createdAt: product.createdAt instanceof Date ? product.createdAt.toISOString() : String(product.createdAt),
  };
}

export async function syncProductToSearch(productId: number): Promise<void> {
  if (!isMeilisearchConfigured()) return;

  const document = await buildProductSearchDocument(productId);
  if (!document || document.status !== "active") {
    await deleteProductFromSearch(productId);
    return;
  }

  await configureProductSearchIndex();
  await meiliRequest(`/indexes/${productsIndex}/documents`, {
    method: "POST",
    body: JSON.stringify([document]),
  });
}

export async function deleteProductFromSearch(productId: number): Promise<void> {
  if (!isMeilisearchConfigured()) return;

  await meiliRequest(`/indexes/${productsIndex}/documents/${productId}`, {
    method: "DELETE",
  });
}

export function syncProductToSearchInBackground(productId: number): void {
  syncProductToSearch(productId).catch((err) => {
    logger.warn({ err, productId }, "Failed to sync product to Meilisearch");
  });
}

export function deleteProductFromSearchInBackground(productId: number): void {
  deleteProductFromSearch(productId).catch((err) => {
    logger.warn({ err, productId }, "Failed to delete product from Meilisearch");
  });
}
