import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, newsletterSignupsTable, siteSettingsTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { requireAdmin, getUserId } from "../middlewares/requireAdmin";
import { sendWelcomeEmail, isEmailConfigured } from "../lib/email";
import { newWelcomeCode, newToken, lookupCode, hasPreviousOrder } from "../lib/welcomeCodes";
import { publicOrigin } from "../seo";

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Don't let the form be used to flood someone's inbox.
const RESEND_GAP_MS = 10 * 60 * 1000;

async function welcomeOffer(): Promise<{ percent: number; days: number }> {
  const [s] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
  return {
    percent: Math.min(Math.max(s?.welcomeDiscountPercent ?? 10, 0), 50),
    days: Math.min(Math.max(s?.welcomeCodeDays ?? 30, 1), 365),
  };
}

// Public: join the list. A new subscriber gets a personal single-use code for
// their first order — shown straight away and emailed. Signing up again simply
// re-sends the (still unused) code.
router.post("/newsletter", async (req, res): Promise<void> => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  try {
    const offer = await welcomeOffer();
    const origin = publicOrigin(req);
    let [row] = await db.select().from(newsletterSignupsTable).where(eq(newsletterSignupsTable.email, email));
    const alreadySubscribed = Boolean(row && !row.unsubscribedAt);

    if (!row) {
      [row] = await db
        .insert(newsletterSignupsTable)
        .values({
          email,
          code: offer.percent > 0 ? newWelcomeCode() : null,
          discountPercent: offer.percent,
          expiresAt: offer.percent > 0 ? new Date(Date.now() + offer.days * 86_400_000) : null,
          unsubscribeToken: newToken(),
        })
        .onConflictDoNothing({ target: newsletterSignupsTable.email })
        .returning();
      if (!row) [row] = await db.select().from(newsletterSignupsTable).where(eq(newsletterSignupsTable.email, email));
    } else if (row.unsubscribedAt || !row.unsubscribeToken) {
      // Re-joining after unsubscribing, or a signup from before codes existed.
      const patch: Partial<typeof newsletterSignupsTable.$inferInsert> = { unsubscribedAt: null, unsubscribeToken: row.unsubscribeToken ?? newToken() };
      if (!row.code && offer.percent > 0) {
        Object.assign(patch, { code: newWelcomeCode(), discountPercent: offer.percent, expiresAt: new Date(Date.now() + offer.days * 86_400_000) });
      }
      [row] = await db.update(newsletterSignupsTable).set(patch).where(eq(newsletterSignupsTable.id, row.id)).returning();
    }

    // The code is only worth sharing while it can still be used.
    const usable = row.code && !row.usedAt && row.discountPercent > 0 && (!row.expiresAt || row.expiresAt.getTime() > Date.now());
    const code = usable ? row.code : null;

    const recentlyEmailed = row.lastEmailedAt && Date.now() - row.lastEmailedAt.getTime() < RESEND_GAP_MS;
    if (!recentlyEmailed) {
      await db.update(newsletterSignupsTable).set({ lastEmailedAt: new Date() }).where(eq(newsletterSignupsTable.id, row.id));
      void sendWelcomeEmail(email, {
        code,
        percent: row.discountPercent,
        expiresAt: row.expiresAt,
        shopUrl: `${origin}/products`,
        unsubscribeUrl: `${origin}/api/newsletter/unsubscribe?token=${encodeURIComponent(row.unsubscribeToken ?? "")}`,
      }).catch((err) => logger.error({ err }, "Welcome email failed"));
    }

    res.status(alreadySubscribed ? 200 : 201).json({
      ok: true,
      alreadySubscribed,
      code,
      percent: code ? row.discountPercent : 0,
      expiresAt: code && row.expiresAt ? row.expiresAt.toISOString() : null,
      emailed: isEmailConfigured(),
      codeUsed: Boolean(row.code && row.usedAt),
    });
  } catch (err) {
    logger.error({ err }, "Failed to store newsletter signup");
    res.status(500).json({ error: "Could not sign you up right now. Please try again." });
  }
});

// One-click unsubscribe from the link in every marketing email.
router.get("/newsletter/unsubscribe", async (req, res): Promise<void> => {
  const token = String(req.query["token"] ?? "");
  let ok = false;
  if (token.length >= 16) {
    const rows = await db
      .update(newsletterSignupsTable)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSignupsTable.unsubscribeToken, token))
      .returning({ id: newsletterSignupsTable.id });
    ok = rows.length > 0;
  }
  const origin = publicOrigin(req);
  res
    .status(ok ? 200 : 404)
    .type("html")
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribed</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f6f4;color:#1a1a1a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:20px;">
<div style="background:#fff;border:1px solid #ececea;border-radius:16px;padding:28px;max-width:420px;text-align:center;">
<h1 style="font-size:20px;margin:0 0 10px;">${ok ? "You've been unsubscribed" : "Link not recognised"}</h1>
<p style="color:#555;margin:0 0 20px;">${ok ? "You won't get marketing emails from Happyfine Wholesalers any more. Order emails still arrive as normal." : "This unsubscribe link is invalid or has already been used."}</p>
<a href="${origin}/" style="display:inline-block;background:#e8430f;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">Back to the shop</a>
</div></body></html>`);
});

// Checkout: check a code before the order is placed (the order route re-checks).
router.get("/discount-codes/validate", async (req, res): Promise<void> => {
  const check = await lookupCode(req.query["code"]);
  if (!check.ok) {
    res.json({ valid: false, error: check.error });
    return;
  }
  const email = typeof req.query["email"] === "string" ? req.query["email"] : null;
  const phone = typeof req.query["phone"] === "string" ? req.query["phone"] : null;
  if (await hasPreviousOrder({ userId: getUserId(req), email, phone })) {
    res.json({ valid: false, error: "Welcome codes are for your first order only." });
    return;
  }
  res.json({ valid: true, code: check.code, percent: check.percent });
});

// Admin: everyone on the list, newest first (JSON, or CSV for export).
router.get("/admin/subscribers", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(newsletterSignupsTable).orderBy(desc(newsletterSignupsTable.createdAt));
  const items = rows.map((r) => ({
    id: r.id,
    email: r.email,
    code: r.code,
    discountPercent: r.discountPercent,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    usedAt: r.usedAt?.toISOString() ?? null,
    usedOrderId: r.usedOrderId,
    unsubscribed: Boolean(r.unsubscribedAt),
    createdAt: r.createdAt.toISOString(),
  }));
  if (req.query["format"] === "csv") {
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["Email", "Joined", "Subscribed", "Welcome code", "Discount %", "Code used", "Order"].join(","),
      ...items.map((i) =>
        [q(i.email), q(i.createdAt.slice(0, 10)), q(i.unsubscribed ? "No" : "Yes"), q(i.code), q(i.discountPercent), q(i.usedAt ? i.usedAt.slice(0, 10) : ""), q(i.usedOrderId ?? "")].join(","),
      ),
    ];
    res
      .type("text/csv")
      .set("Content-Disposition", `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`)
      .send(lines.join("\n"));
    return;
  }
  res.json({
    items,
    total: items.length,
    active: items.filter((i) => !i.unsubscribed).length,
    codesUsed: items.filter((i) => i.usedAt).length,
    emailConfigured: isEmailConfigured(),
  });
});

export default router;
