import { Router, type IRouter } from "express";
import { asc, eq } from "drizzle-orm";
import { db, homepageBlocksTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

type Block = typeof homepageBlocksTable.$inferSelect;

function toPublic(b: Block) {
  return {
    id: b.id,
    kind: b.kind,
    imageUrl: b.imageUrl,
    videoUrl: b.videoUrl,
    backgroundColor: b.backgroundColor,
    overlayOpacity: b.overlayOpacity,
    columnSpan: b.columnSpan,
    hideOnMobile: b.hideOnMobile,
    aspectRatio: b.aspectRatio,
    heading: b.heading,
    subheading: b.subheading,
    ctaLabel: b.ctaLabel,
    ctaHref: b.ctaHref,
    textAlign: b.textAlign,
    textColor: b.textColor,
    sortOrder: b.sortOrder,
    active: b.active,
  };
}

const KINDS = new Set(["image", "color", "video"]);

function sanitize(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof body?.kind === "string" && KINDS.has(body.kind)) out.kind = body.kind;
  if ("imageUrl" in body) out.imageUrl = body.imageUrl || null;
  if ("videoUrl" in body) out.videoUrl = body.videoUrl || null;
  if ("backgroundColor" in body) out.backgroundColor = body.backgroundColor || null;
  if (body?.overlayOpacity !== undefined) out.overlayOpacity = Math.min(Math.max(parseInt(body.overlayOpacity, 10) || 0, 0), 100);
  if (body?.columnSpan !== undefined) out.columnSpan = Math.min(Math.max(parseInt(body.columnSpan, 10) || 12, 1), 12);
  if (typeof body?.hideOnMobile === "boolean") out.hideOnMobile = body.hideOnMobile;
  if (typeof body?.aspectRatio === "string" && body.aspectRatio.trim()) out.aspectRatio = body.aspectRatio.trim();
  if ("heading" in body) out.heading = body.heading || null;
  if ("subheading" in body) out.subheading = body.subheading || null;
  if ("ctaLabel" in body) out.ctaLabel = body.ctaLabel || null;
  if ("ctaHref" in body) out.ctaHref = body.ctaHref || null;
  if (typeof body?.textAlign === "string" && body.textAlign.trim()) out.textAlign = body.textAlign.trim();
  if (typeof body?.textColor === "string" && body.textColor.trim()) out.textColor = body.textColor.trim();
  if (body?.sortOrder !== undefined) out.sortOrder = parseInt(body.sortOrder, 10) || 0;
  if (typeof body?.active === "boolean") out.active = body.active;
  return out;
}

// Public: active blocks in display order (homepage grid).
router.get("/homepage-blocks", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(homepageBlocksTable)
    .where(eq(homepageBlocksTable.active, true))
    .orderBy(asc(homepageBlocksTable.sortOrder), asc(homepageBlocksTable.id));
  res.json(rows.map(toPublic));
});

// Admin: all blocks (including inactive) for management.
router.get("/admin/homepage-blocks", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(homepageBlocksTable)
    .orderBy(asc(homepageBlocksTable.sortOrder), asc(homepageBlocksTable.id));
  res.json(rows.map(toPublic));
});

router.post("/homepage-blocks", requireAdmin, async (req, res): Promise<void> => {
  const data = sanitize(req.body ?? {});
  const [row] = await db.insert(homepageBlocksTable).values(data).returning();
  res.status(201).json(toPublic(row));
});

router.patch("/homepage-blocks/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const data = sanitize(req.body ?? {});
  const [row] = await db.update(homepageBlocksTable).set(data).where(eq(homepageBlocksTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Block not found" });
    return;
  }
  res.json(toPublic(row));
});

router.delete("/homepage-blocks/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(homepageBlocksTable).where(eq(homepageBlocksTable.id, id));
  res.sendStatus(204);
});

export default router;
