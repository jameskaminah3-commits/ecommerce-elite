import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// A single-row table (id = 1) holding editable site-wide content — currently the
// footer. Read publicly by the storefront, written from the admin console.
export interface FooterLink {
  label: string;
  href: string;
}

export const siteSettingsTable = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  brandBlurb: text("brand_blurb").notNull().default(""),
  aboutHeading: text("about_heading").notNull().default("About us"),
  aboutLinks: jsonb("about_links").$type<FooterLink[]>().notNull().default([]),
  supportHeading: text("support_heading").notNull().default("Customer support"),
  supportLinks: jsonb("support_links").$type<FooterLink[]>().notNull().default([]),
  contactPhone: text("contact_phone").notNull().default(""),
  contactEmail: text("contact_email").notNull().default(""),
  liveChatUrl: text("live_chat_url").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  pinterestUrl: text("pinterest_url").notNull().default(""),
  tiktokUrl: text("tiktok_url").notNull().default(""),
  // Payment badge keys, e.g. ["mpesa","visa","mastercard","paypal"].
  acceptedPayments: jsonb("accepted_payments").$type<string[]>().notNull().default([]),
  currencyLabel: text("currency_label").notNull().default("Kenya (KES)"),
  copyrightText: text("copyright_text").notNull().default("Happyfine Wholesalers"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SiteSettings = typeof siteSettingsTable.$inferSelect;
