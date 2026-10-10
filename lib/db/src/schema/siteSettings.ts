import { pgTable, serial, text, jsonb, timestamp, boolean, integer } from "drizzle-orm/pg-core";

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
  // WhatsApp number for "Chat on WhatsApp" links. Blank = the first contact phone.
  whatsappNumber: text("whatsapp_number").notNull().default(""),
  // Google Search Console "HTML tag" verification code (the content="…" value).
  googleSiteVerification: text("google_site_verification").notNull().default(""),
  facebookUrl: text("facebook_url").notNull().default(""),
  instagramUrl: text("instagram_url").notNull().default(""),
  pinterestUrl: text("pinterest_url").notNull().default(""),
  tiktokUrl: text("tiktok_url").notNull().default(""),
  // Payment badge keys, e.g. ["mpesa","visa","mastercard","paypal"].
  acceptedPayments: jsonb("accepted_payments").$type<string[]>().notNull().default([]),
  currencyLabel: text("currency_label").notNull().default("Kenya (KES)"),
  copyrightText: text("copyright_text").notNull().default("Happyfine Wholesalers"),
  // Manual M-Pesa payment details — the fallback shown when the STK push can't
  // complete. Any subset may be set; the storefront shows whichever are present.
  mpesaPaybill: text("mpesa_paybill").notNull().default(""),
  mpesaTill: text("mpesa_till").notNull().default(""),
  mpesaAccountName: text("mpesa_account_name").notNull().default(""),
  mpesaSendPhone: text("mpesa_send_phone").notNull().default(""),
  // Pochi la Biashara: the business wallet small shops use — customers pay it from
  // Lipa na M-PESA using the shop's phone number and see the business name.
  mpesaPochiPhone: text("mpesa_pochi_phone").notNull().default(""),
  mpesaInstructions: text("mpesa_instructions").notNull().default(""),
  // When false, the online channels (M-Pesa STK push, Airtel Money, card) are hidden at
  // checkout and only manual M-Pesa is offered — e.g. while the payment gateway is
  // still being set up. They are also hidden automatically if the gateway isn't configured.
  onlinePaymentsEnabled: boolean("online_payments_enabled").notNull().default(true),
  // Who is emailed when an order is placed / a payment code is submitted. Comma-separated.
  orderNotifyEmails: text("order_notify_emails").notNull().default(""),
  // Referral promotion: a friend who checks out with a referral code gets this
  // percentage off their first order. Disabled by default.
  // Newsletter welcome offer: each new subscriber gets a single-use code worth this
  // percentage off their first order, valid for this many days. 0% = no offer.
  welcomeDiscountPercent: integer("welcome_discount_percent").notNull().default(10),
  welcomeCodeDays: integer("welcome_code_days").notNull().default(30),
  referralEnabled: boolean("referral_enabled").notNull().default(false),
  referralDiscountPercent: integer("referral_discount_percent").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SiteSettings = typeof siteSettingsTable.$inferSelect;
