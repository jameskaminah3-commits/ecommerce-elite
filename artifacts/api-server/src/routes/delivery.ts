import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, deliveryLocationsTable, deliveryClassesTable, deliveryRatesTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

// Postgres unique-violation code, whether the pg error is raw or drizzle-wrapped.
function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

const router: IRouter = Router();

function toPublic(row: typeof deliveryLocationsTable.$inferSelect) {
  return { id: row.id, name: row.name, cost: parseFloat(row.cost), active: row.active };
}

// List delivery locations (public — checkout needs the towns and costs).
router.get("/delivery-locations", async (_req, res): Promise<void> => {
  const rows = await db.select().from(deliveryLocationsTable).orderBy(deliveryLocationsTable.name);
  res.json(rows.map(toPublic));
});

router.post("/delivery-locations", requireAdmin, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const cost = Number(req.body?.cost);
  const active = req.body?.active !== false;
  if (!name || Number.isNaN(cost) || cost < 0) {
    res.status(400).json({ error: "A name and a non-negative cost are required." });
    return;
  }
  try {
    const [row] = await db
      .insert(deliveryLocationsTable)
      .values({ name, cost: String(cost), active })
      .returning();
    res.status(201).json(toPublic(row));
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: `"${name}" already exists. Edit its cost in the list instead.` });
    } else {
      logger.error({ err }, "Failed to create delivery location");
      res.status(500).json({ error: "Failed to create delivery location." });
    }
  }
});

router.patch("/delivery-locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const data: Record<string, unknown> = {};
  if (typeof req.body?.name === "string") data.name = req.body.name.trim();
  if (req.body?.cost !== undefined) {
    const cost = Number(req.body.cost);
    if (Number.isNaN(cost) || cost < 0) {
      res.status(400).json({ error: "Invalid cost" });
      return;
    }
    data.cost = String(cost);
  }
  if (typeof req.body?.active === "boolean") data.active = req.body.active;

  const [row] = await db
    .update(deliveryLocationsTable)
    .set(data)
    .where(eq(deliveryLocationsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Location not found" });
    return;
  }
  res.json(toPublic(row));
});

router.delete("/delivery-locations/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(deliveryLocationsTable).where(eq(deliveryLocationsTable.id, id));
  res.sendStatus(204);
});

// ── DELIVERY CLASSES ──────────────────────────────────────────────────────
router.get("/delivery-classes", async (_req, res): Promise<void> => {
  const rows = await db.select().from(deliveryClassesTable).orderBy(deliveryClassesTable.name);
  res.json(rows.map((c) => ({ id: c.id, name: c.name, active: c.active })));
});

router.post("/delivery-classes", requireAdmin, async (req, res): Promise<void> => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "A class name is required." });
    return;
  }
  try {
    const [row] = await db.insert(deliveryClassesTable).values({ name }).returning();
    res.status(201).json({ id: row.id, name: row.name, active: row.active });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: `"${name}" already exists.` });
    } else {
      logger.error({ err }, "Failed to create delivery class");
      res.status(500).json({ error: "Failed to create delivery class." });
    }
  }
});

router.delete("/delivery-classes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(deliveryClassesTable).where(eq(deliveryClassesTable.id, id));
  res.sendStatus(204);
});

// ── RATE MATRIX (town × class overrides) ──────────────────────────────────
router.get("/delivery-rates", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(deliveryRatesTable);
  res.json(rows.map((r) => ({ locationId: r.locationId, classId: r.classId, cost: parseFloat(r.cost) })));
});

// Upsert (or clear) a single town/class cost.
router.put("/delivery-rates", requireAdmin, async (req, res): Promise<void> => {
  const locationId = Number(req.body?.locationId);
  const classId = Number(req.body?.classId);
  if (Number.isNaN(locationId) || Number.isNaN(classId)) {
    res.status(400).json({ error: "locationId and classId are required." });
    return;
  }
  // Empty/blank cost clears the override so the town base applies again.
  if (req.body?.cost === null || req.body?.cost === "" || req.body?.cost === undefined) {
    await db
      .delete(deliveryRatesTable)
      .where(and(eq(deliveryRatesTable.locationId, locationId), eq(deliveryRatesTable.classId, classId)));
    res.json({ locationId, classId, cost: null });
    return;
  }
  const cost = Number(req.body.cost);
  if (Number.isNaN(cost) || cost < 0) {
    res.status(400).json({ error: "Invalid cost" });
    return;
  }
  await db
    .insert(deliveryRatesTable)
    .values({ locationId, classId, cost: String(cost) })
    .onConflictDoUpdate({
      target: [deliveryRatesTable.locationId, deliveryRatesTable.classId],
      set: { cost: String(cost) },
    });
  res.json({ locationId, classId, cost });
});

export default router;
