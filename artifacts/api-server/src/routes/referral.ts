import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, siteSettingsTable } from "@workspace/db";
import { findReferrerByCode } from "../lib/referral";

const router: IRouter = Router();

// Public: the storefront checks a shared referral code so it can show the
// visitor "You'll get X% off your first order" and apply it at checkout.
router.get("/referral/validate", async (req, res): Promise<void> => {
  const code = String(req.query.code ?? "").trim();
  const [settings] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
  const enabled = Boolean(settings?.referralEnabled);
  const pct = enabled ? Math.min(Math.max(settings?.referralDiscountPercent ?? 0, 0), 90) : 0;
  if (!code || pct <= 0) {
    res.json({ valid: false, discountPercent: 0 });
    return;
  }
  const referrer = await findReferrerByCode(code);
  if (!referrer) {
    res.json({ valid: false, discountPercent: 0 });
    return;
  }
  // Only the referrer's first name is exposed, for a friendly "Referred by Amina".
  res.json({ valid: true, discountPercent: pct, referrerName: referrer.name.split(" ")[0] });
});

export default router;
