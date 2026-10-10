import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, siteSettingsTable, type FooterLink } from "@workspace/db";
import { requireAdmin, isAdminRequest } from "../middlewares/requireAdmin";
import { paymentOptionsFrom } from "../lib/paymentOptions";
import { parseEmailList } from "../lib/orderNotifications";
import { manualPaymentHoldMs } from "../lib/inventory";

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
  mpesaPochiPhone: "",
  mpesaInstructions: "",
  onlinePaymentsEnabled: true,
  orderNotifyEmails: "",
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

// What the storefront needs, plus what's actually available to pay with right now.
// The team's notification addresses are private: only admins get them.
function view(row: Awaited<ReturnType<typeof getOrCreate>>, isAdmin: boolean) {
  const options = paymentOptionsFrom(row);
  const { orderNotifyEmails, ...publicRow } = row;
  return {
    ...(isAdmin ? { ...publicRow, orderNotifyEmails } : publicRow),
    onlinePaymentsAvailable: options.onlineAvailable,
    manualMpesaAvailable: options.manualMpesaAvailable,
    manualPaymentMode: options.manualPaymentMode,
    // How long a pay-by-M-PESA order keeps its items reserved (shown to customers).
    manualHoldHours: Math.max(1, Math.round(manualPaymentHoldMs() / 3_600_000)),
  };
}

// Public: the storefront footer and checkout read this.
router.get("/site-settings", async (req, res): Promise<void> => {
  const row = await getOrCreate();
  res.json(view(row, await isAdminRequest(req)));
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
    "mpesaPaybill", "mpesaTill", "mpesaAccountName", "mpesaSendPhone", "mpesaPochiPhone",
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
  if (has("onlinePaymentsEnabled")) patch.onlinePaymentsEnabled = Boolean(b["onlinePaymentsEnabled"]);
  // Keep only well-formed addresses, normalised to a clean comma-separated list.
  if (has("orderNotifyEmails")) patch.orderNotifyEmails = parseEmailList(str(b["orderNotifyEmails"])).slice(0, 10).join(", ");
  if (has("referralEnabled")) patch.referralEnabled = Boolean(b["referralEnabled"]);
  if (has("referralDiscountPercent")) {
    patch.referralDiscountPercent = Math.min(Math.max(parseInt(String(b["referralDiscountPercent"]), 10) || 0, 0), 90);
  }

  await getOrCreate();
  if (Object.keys(patch).length === 0) {
    res.json(view(await getOrCreate(), true));
    return;
  }
  const [updated] = await db.update(siteSettingsTable).set(patch).where(eq(siteSettingsTable.id, 1)).returning();
  res.json(view(updated, true));
});

export default router;
