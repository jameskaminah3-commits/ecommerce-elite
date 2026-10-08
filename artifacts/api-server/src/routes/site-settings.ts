import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, siteSettingsTable, type FooterLink } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

// Sensible starting content so the footer looks complete before any admin edit.
const DEFAULTS = {
  brandBlurb: "Wholesale prices for everyone — buy just one, no minimum order. Delivered across Kenya.",
  aboutHeading: "About us",
  aboutLinks: [
    { label: "Our story", href: "/about" },
    { label: "FAQ", href: "/faq" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ] as FooterLink[],
  supportHeading: "Customer support",
  supportLinks: [
    { label: "Shipping info", href: "/shipping" },
    { label: "Refunds & returns", href: "/returns" },
    { label: "Terms & conditions", href: "/terms" },
  ] as FooterLink[],
  contactPhone: "+254 700 000 000",
  contactEmail: "support@happyfine.co.ke",
  liveChatUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  pinterestUrl: "",
  tiktokUrl: "",
  acceptedPayments: ["mpesa", "visa", "mastercard", "amex", "paypal"],
  currencyLabel: "Kenya (KES)",
  copyrightText: "Happyfine Wholesalers",
  mpesaPaybill: "",
  mpesaTill: "",
  mpesaAccountName: "",
  mpesaSendPhone: "",
  mpesaInstructions: "",
  referralEnabled: false,
  referralDiscountPercent: 0,
};

async function getOrCreate() {
  const [existing] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
  if (existing) return existing;
  const [created] = await db
    .insert(siteSettingsTable)
    .values({ id: 1, ...DEFAULTS })
    .onConflictDoNothing({ target: siteSettingsTable.id })
    .returning();
  if (created) return created;
  const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
  return row;
}

// Public: the storefront footer reads this.
router.get("/site-settings", async (_req, res): Promise<void> => {
  const row = await getOrCreate();
  res.json(row);
});

// Admin: save site settings. This is a PARTIAL update — only the fields present
// in the request body are changed, so one admin screen (footer, M-Pesa details,
// referral promo) can never blank out another screen's fields.
router.put("/site-settings", requireAdmin, async (req, res): Promise<void> => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const links = (v: unknown): FooterLink[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x.label === "string" && typeof x.href === "string")
          .map((x) => ({ label: String(x.label).slice(0, 120), href: String(x.href).slice(0, 300) }))
      : [];

  const patch: Partial<typeof siteSettingsTable.$inferInsert> = {};
  const textFields = [
    "brandBlurb", "aboutHeading", "supportHeading", "contactPhone", "contactEmail", "liveChatUrl",
    "facebookUrl", "instagramUrl", "pinterestUrl", "tiktokUrl", "currencyLabel", "copyrightText",
    "mpesaPaybill", "mpesaTill", "mpesaAccountName", "mpesaSendPhone",
  ] as const;
  for (const k of textFields) if (has(k)) patch[k] = str(b[k]).trim().slice(0, 500);
  if (has("mpesaInstructions")) patch.mpesaInstructions = str(b["mpesaInstructions"]).slice(0, 500);
  if (has("aboutLinks")) patch.aboutLinks = links(b["aboutLinks"]);
  if (has("supportLinks")) patch.supportLinks = links(b["supportLinks"]);
  if (has("acceptedPayments")) {
    patch.acceptedPayments = Array.isArray(b["acceptedPayments"])
      ? (b["acceptedPayments"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  }
  if (has("referralEnabled")) patch.referralEnabled = Boolean(b["referralEnabled"]);
  if (has("referralDiscountPercent")) {
    patch.referralDiscountPercent = Math.min(Math.max(parseInt(String(b["referralDiscountPercent"]), 10) || 0, 0), 90);
  }

  await getOrCreate();
  if (Object.keys(patch).length === 0) {
    res.json(await getOrCreate());
    return;
  }
  const [updated] = await db.update(siteSettingsTable).set(patch).where(eq(siteSettingsTable.id, 1)).returning();
  res.json(updated);
});

export default router;
