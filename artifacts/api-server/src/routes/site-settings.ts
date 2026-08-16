import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, siteSettingsTable, type FooterLink } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

// Sensible starting content so the footer looks complete before any admin edit.
const DEFAULTS = {
  brandBlurb: "Wholesale prices, delivered across Kenya. Quality you'll love, at prices that make sense.",
  aboutHeading: "About us",
  aboutLinks: [
    { label: "Our story", href: "/" },
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
  acceptedPayments: ["mpesa", "visa", "mastercard", "paystack"],
  currencyLabel: "Kenya (KES)",
  copyrightText: "Happyfine Wholesalers",
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

// Admin: save the footer content. Only known fields are accepted.
router.put("/site-settings", requireAdmin, async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
  const links = (v: unknown): FooterLink[] =>
    Array.isArray(v)
      ? v
          .filter((x) => x && typeof x.label === "string" && typeof x.href === "string")
          .map((x) => ({ label: String(x.label).slice(0, 120), href: String(x.href).slice(0, 300) }))
      : [];

  await getOrCreate();
  const [updated] = await db
    .update(siteSettingsTable)
    .set({
      brandBlurb: str(b.brandBlurb),
      aboutHeading: str(b.aboutHeading, "About us"),
      aboutLinks: links(b.aboutLinks),
      supportHeading: str(b.supportHeading, "Customer support"),
      supportLinks: links(b.supportLinks),
      contactPhone: str(b.contactPhone),
      contactEmail: str(b.contactEmail),
      liveChatUrl: str(b.liveChatUrl),
      facebookUrl: str(b.facebookUrl),
      instagramUrl: str(b.instagramUrl),
      pinterestUrl: str(b.pinterestUrl),
      tiktokUrl: str(b.tiktokUrl),
      acceptedPayments: Array.isArray(b.acceptedPayments)
        ? b.acceptedPayments.filter((x: unknown) => typeof x === "string")
        : [],
      currencyLabel: str(b.currencyLabel, "Kenya (KES)"),
      copyrightText: str(b.copyrightText, "Happyfine Wholesalers"),
    })
    .where(eq(siteSettingsTable.id, 1))
    .returning();

  res.json(updated);
});

export default router;
