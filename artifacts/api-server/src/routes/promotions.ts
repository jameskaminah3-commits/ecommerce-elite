import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, inArray, lte } from "drizzle-orm";
import { db, promotionsTable, productsTable, categoriesTable, PROMOTION_THEMES, PROMOTION_SCOPES, type Promotion } from "@workspace/db";
import { clampPercent, effectiveDiscount, discountedPrice, expandCategoryIds, loadCategoryChildren, type PricingPromo } from "../lib/pricing";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

type Status = "live" | "scheduled" | "ended" | "off";

function statusOf(p: Promotion, now = new Date()): Status {
  if (!p.enabled) return "off";
  if (p.endsAt <= now) return "ended";
  if (p.startsAt > now) return "scheduled";
  return "live";
}

// "20% off everything" / "20% off Audio & Beauty" / "20% off selected items" — the
// plain-English line the banner shows, so the promise is stated exactly.
async function discountLabel(p: Pick<Promotion, "discountPercent" | "scope" | "categoryIds">): Promise<string> {
  if (p.discountPercent <= 0) return "";
  const pct = `${p.discountPercent}% off`;
  if (p.scope === "all") return `${pct} everything`;
  if (p.scope === "products") return `${pct} selected items`;
  if (p.categoryIds.length === 0) return pct;
  const rows = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(inArray(categoriesTable.id, p.categoryIds));
  const names = rows.map((r) => r.name);
  if (names.length === 0) return pct;
  if (names.length <= 2) return `${pct} ${names.join(" & ")}`;
  return `${pct} ${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}

async function toJson(p: Promotion) {
  return {
    id: p.id,
    name: p.name,
    title: p.title,
    subtitle: p.subtitle,
    announcement: p.announcement,
    ctaLabel: p.ctaLabel,
    ctaHref: p.ctaHref,
    theme: p.theme,
    showCountdown: p.showCountdown,
    discountPercent: p.discountPercent,
    scope: p.scope,
    categoryIds: p.categoryIds,
    productIds: p.productIds,
    discountLabel: await discountLabel(p),
    startsAt: p.startsAt.toISOString(),
    endsAt: p.endsAt.toISOString(),
    enabled: p.enabled,
    status: statusOf(p),
  };
}

// Public: whatever is live right now. `serverNow` lets the browser correct for a
// wrong phone clock, so the countdown matches the real deadline.
router.get("/promotions/active", async (_req, res): Promise<void> => {
  const now = new Date();
  const rows = await db
    .select()
    .from(promotionsTable)
    .where(and(eq(promotionsTable.enabled, true), lte(promotionsTable.startsAt, now), gt(promotionsTable.endsAt, now)))
    // The most recently started campaign wins when several overlap.
    .orderBy(desc(promotionsTable.startsAt));
  // Always revalidate: when an admin pauses or deletes a campaign it must vanish
  // for shoppers immediately, not after a cache expires.
  res.set("Cache-Control", "no-cache");
  res.json({
    serverNow: now.toISOString(),
    items: await Promise.all(
      rows.map(async (p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        announcement: p.announcement,
        ctaLabel: p.ctaLabel,
        ctaHref: p.ctaHref,
        theme: p.theme,
        showCountdown: p.showCountdown,
        discountPercent: p.discountPercent,
        discountLabel: await discountLabel(p),
        endsAt: p.endsAt.toISOString(),
      })),
    ),
  });
});

// ── Admin ────────────────────────────────────────────────────────────────────
router.get("/admin/promotions", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(promotionsTable).orderBy(asc(promotionsTable.startsAt));
  res.json({ serverNow: new Date().toISOString(), items: await Promise.all(rows.map(toJson)) });
});

// Validate + normalise a request body. Returns an error string or the clean values.
function parseBody(b: any): { error: string } | { values: Omit<typeof promotionsTable.$inferInsert, "id"> } {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(b?.name, 120);
  const title = str(b?.title, 120);
  if (!name) return { error: "Give the promotion an internal name (e.g. “Black Friday 2026”)." };
  if (!title) return { error: "The banner needs a headline." };

  const startsAt = new Date(b?.startsAt);
  const endsAt = new Date(b?.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return { error: "Start and end dates are required." };
  if (endsAt <= startsAt) return { error: "The end must be after the start." };

  // Links must stay on-site or be https — never javascript: or similar.
  const ctaHref = str(b?.ctaHref, 300) || "/products";
  if (!(ctaHref.startsWith("/") && !ctaHref.startsWith("//")) && !/^https:\/\//i.test(ctaHref)) {
    return { error: "The button link must start with / (a page on this site) or https://." };
  }
  const theme = PROMOTION_THEMES.includes(b?.theme) ? b.theme : "brand";

  // Discount: 0 = banner only. Otherwise 1-90%, with an explicit scope so it is
  // never applied to more (or less) than the admin intended.
  const discountPercent = clampPercent(b?.discountPercent);
  const scope = PROMOTION_SCOPES.includes(b?.scope) ? b.scope : "all";
  const ids = (v: unknown): number[] =>
    Array.isArray(v) ? [...new Set(v.map((x) => parseInt(String(x), 10)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 1000) : [];
  const categoryIds = scope === "categories" ? ids(b?.categoryIds) : [];
  const productIds = scope === "products" ? ids(b?.productIds) : [];
  if (discountPercent > 0 && scope === "categories" && categoryIds.length === 0) return { error: "Choose at least one category for the discount." };
  if (discountPercent > 0 && scope === "products" && productIds.length === 0) return { error: "Choose at least one product for the discount." };

  return {
    values: {
      name,
      title,
      subtitle: str(b?.subtitle, 240),
      announcement: str(b?.announcement, 160),
      ctaLabel: str(b?.ctaLabel, 40) || "Shop the deals",
      ctaHref,
      theme,
      showCountdown: b?.showCountdown !== false,
      discountPercent,
      scope,
      categoryIds,
      productIds,
      startsAt,
      endsAt,
      enabled: b?.enabled !== false,
    },
  };
}

// Before saving: exactly what would this discount do? Counts the products it
// changes, the ones that keep a bigger existing Offer, and shows real examples.
router.post("/admin/promotions/impact", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const percent = clampPercent(b.discountPercent);
  const scope = PROMOTION_SCOPES.includes(b.scope) ? (b.scope as "all" | "categories" | "products") : "all";
  const toIds = (v: unknown): number[] => (Array.isArray(v) ? v.map((x) => parseInt(String(x), 10)).filter((n) => Number.isInteger(n) && n > 0) : []);
  if (percent <= 0) {
    res.json({ percent: 0, covered: 0, changed: 0, keepsOffer: 0, samples: [] });
    return;
  }
  const tree = scope === "categories" ? await loadCategoryChildren() : new Map<number, number[]>();
  const promo: PricingPromo = {
    id: 0,
    title: "",
    percent,
    scope,
    categoryIds: scope === "categories" ? expandCategoryIds(toIds(b.categoryIds), tree) : [],
    productIds: scope === "products" ? toIds(b.productIds) : [],
    endsAt: new Date(),
  };
  const products = await db
    .select({ id: productsTable.id, name: productsTable.name, categoryId: productsTable.categoryId, basePrice: productsTable.basePrice, discountPercent: productsTable.discountPercent })
    .from(productsTable)
    .where(eq(productsTable.status, "active"));

  let covered = 0;
  let changed = 0;
  const samples: { id: number; name: string; before: number; after: number; offerPercent: number }[] = [];
  for (const p of products) {
    const withPromo = effectiveDiscount(p, [promo]);
    const matched = withPromo.source === "promotion" || (effectiveDiscount({ ...p, discountPercent: 0 }, [promo]).source === "promotion");
    if (!matched) continue;
    covered++;
    if (withPromo.source === "promotion") {
      changed++;
      if (samples.length < 4) {
        const list = parseFloat(p.basePrice);
        const before = discountedPrice(list, clampPercent(p.discountPercent));
        samples.push({ id: p.id, name: p.name, before, after: discountedPrice(list, percent), offerPercent: clampPercent(p.discountPercent) });
      }
    }
  }
  res.json({ percent, covered, changed, keepsOffer: covered - changed, samples });
});

router.post("/admin/promotions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = parseBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db.insert(promotionsTable).values(parsed.values).returning();
  res.status(201).json(await toJson(row));
});

router.put("/admin/promotions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = parseBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db.update(promotionsTable).set(parsed.values).where(eq(promotionsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Promotion not found" });
    return;
  }
  res.json(await toJson(row));
});

router.delete("/admin/promotions/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(promotionsTable).where(eq(promotionsTable.id, id));
  res.sendStatus(204);
});

export default router;
