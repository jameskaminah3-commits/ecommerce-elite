import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { db, promotionsTable, PROMOTION_THEMES, type Promotion } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

type Status = "live" | "scheduled" | "ended" | "off";

function statusOf(p: Promotion, now = new Date()): Status {
  if (!p.enabled) return "off";
  if (p.endsAt <= now) return "ended";
  if (p.startsAt > now) return "scheduled";
  return "live";
}

function toJson(p: Promotion) {
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
    items: rows.map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.subtitle,
      announcement: p.announcement,
      ctaLabel: p.ctaLabel,
      ctaHref: p.ctaHref,
      theme: p.theme,
      showCountdown: p.showCountdown,
      endsAt: p.endsAt.toISOString(),
    })),
  });
});

// ── Admin ────────────────────────────────────────────────────────────────────
router.get("/admin/promotions", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(promotionsTable).orderBy(asc(promotionsTable.startsAt));
  res.json({ serverNow: new Date().toISOString(), items: rows.map(toJson) });
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
      startsAt,
      endsAt,
      enabled: b?.enabled !== false,
    },
  };
}

router.post("/admin/promotions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = parseBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [row] = await db.insert(promotionsTable).values(parsed.values).returning();
  res.status(201).json(toJson(row));
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
  res.json(toJson(row));
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
