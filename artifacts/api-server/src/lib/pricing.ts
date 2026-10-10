import { and, eq, gt, lte, sql, type SQL } from "drizzle-orm";
import { db, promotionsTable, categoriesTable } from "@workspace/db";
import { logger } from "./logger";

// One source of truth for "what discount applies to this product right now".
// A product's price can be reduced by (a) an Offer set on the product itself, or
// (b) a live Promotion that covers it. Shoppers get whichever is BIGGER - the two
// never stack. Every route that shows or charges a price goes through here, so the
// listing, product page, cart, checkout and SEO tags can never disagree.

export interface PricingPromo {
  id: number;
  title: string;
  percent: number;
  scope: "all" | "categories" | "products";
  /** Selected categories expanded to include every descendant. */
  categoryIds: number[];
  productIds: number[];
  endsAt: Date;
}

export interface EffectiveDiscount {
  percent: number;
  /** Where the winning discount came from. */
  source: "offer" | "promotion" | null;
  promo: PricingPromo | null;
}

export const clampPercent = (n: number | null | undefined): number => Math.min(Math.max(Math.round(Number(n) || 0), 0), 90);

// Promotions that are live right now AND actually discount something. Always read
// fresh: pricing must be correct the instant an admin pauses or ends a campaign.
export async function loadPricingPromos(now = new Date()): Promise<PricingPromo[]> {
  // Promotions are a layer on top of the catalogue: if they can't be read (a table
  // not migrated yet, a transient DB error) products simply show their normal
  // prices — the shop must never go down because of a campaign lookup.
  try {
    return await loadPricingPromosUnsafe(now);
  } catch (err) {
    logger.warn({ err: (err as Error)?.message }, "Promotion pricing unavailable — using regular prices");
    return [];
  }
}

async function loadPricingPromosUnsafe(now: Date): Promise<PricingPromo[]> {
  const rows = await db
    .select()
    .from(promotionsTable)
    .where(
      and(
        eq(promotionsTable.enabled, true),
        lte(promotionsTable.startsAt, now),
        gt(promotionsTable.endsAt, now),
        gt(promotionsTable.discountPercent, 0),
      ),
    );
  if (rows.length === 0) return [];

  const tree = rows.some((r) => r.scope === "categories") ? await loadCategoryChildren() : new Map<number, number[]>();

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    percent: clampPercent(r.discountPercent),
    scope: r.scope,
    categoryIds: r.scope === "categories" ? expandCategoryIds(r.categoryIds, tree) : [],
    productIds: r.scope === "products" ? r.productIds : [],
    endsAt: r.endsAt,
  }));
}

// Parent -> children map of the category tree.
export async function loadCategoryChildren(): Promise<Map<number, number[]>> {
  const cats = await db.select({ id: categoriesTable.id, parentId: categoriesTable.parentId }).from(categoriesTable);
  const children = new Map<number, number[]>();
  for (const c of cats) {
    if (c.parentId != null) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c.id]);
  }
  return children;
}

// "Electronics" -> Electronics plus every subcategory beneath it.
export function expandCategoryIds(roots: number[], children: Map<number, number[]>): number[] {
  const out = new Set<number>();
  const stack = [...roots];
  while (stack.length) {
    const id = stack.pop() as number;
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return [...out];
}

export const promoCovers = (promo: PricingPromo, p: { id: number; categoryId: number }): boolean =>
  promo.scope === "all" ||
  (promo.scope === "categories" && promo.categoryIds.includes(p.categoryId)) ||
  (promo.scope === "products" && promo.productIds.includes(p.id));

export function effectiveDiscount(
  p: { id: number; categoryId: number; discountPercent?: number | null },
  promos: PricingPromo[],
): EffectiveDiscount {
  const offer = clampPercent(p.discountPercent);
  let best: PricingPromo | null = null;
  for (const promo of promos) {
    if (promoCovers(promo, p) && (!best || promo.percent > best.percent)) best = promo;
  }
  if (best && best.percent > offer) return { percent: best.percent, source: "promotion", promo: best };
  return { percent: offer, source: offer > 0 ? "offer" : null, promo: null };
}

export const discountedPrice = (list: number, percent: number): number => Math.round(list * (1 - percent / 100) * 100) / 100;

// The same rule as a SQL expression, so price filters and price sorting in the
// listing use the price shoppers actually pay (a KES 1,100 item on 20% off is
// "under KES 1,000"). Mirrors effectiveDiscount().
export function effectiveDiscountSql(promos: PricingPromo[]): SQL {
  const parts: SQL[] = [sql`products.discount_percent`];
  for (const promo of promos) {
    if (promo.scope === "all") parts.push(sql`${promo.percent}`);
    else if (promo.scope === "categories" && promo.categoryIds.length)
      parts.push(sql`(case when products.category_id in (${sql.join(promo.categoryIds.map((i) => sql`${i}`), sql`, `)}) then ${promo.percent} else 0 end)`);
    else if (promo.scope === "products" && promo.productIds.length)
      parts.push(sql`(case when products.id in (${sql.join(promo.productIds.map((i) => sql`${i}`), sql`, `)}) then ${promo.percent} else 0 end)`);
  }
  return sql`least(greatest(${sql.join(parts, sql`, `)}, 0), 90)`;
}

export const effectivePriceSql = (promos: PricingPromo[]): SQL =>
  sql`(products.base_price * (1 - ${effectiveDiscountSql(promos)} / 100.0))`;
