import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

// A scheduled marketing campaign (Black Friday, Christmas, a weekend flash sale…).
// While it is live — enabled and between startsAt and endsAt — the storefront
// shows a countdown banner on the homepage and, optionally, swaps the top
// announcement bar. It switches on and off by itself; no code or redeploy.
//
// This is the *campaign layer*. Actual price discounts are still set per product
// under Offers, so a promotion never advertises a price the checkout won't honour.
export const PROMOTION_THEMES = ["brand", "festive", "gold", "night"] as const;
export type PromotionTheme = (typeof PROMOTION_THEMES)[number];

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  // Internal label for the admin list, e.g. "Black Friday 2026".
  name: text("name").notNull(),
  // What shoppers see.
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  // Optional line for the slim bar at the very top of every page while live.
  announcement: text("announcement").notNull().default(""),
  ctaLabel: text("cta_label").notNull().default("Shop the deals"),
  ctaHref: text("cta_href").notNull().default("/products"),
  theme: text("theme", { enum: PROMOTION_THEMES }).notNull().default("brand"),
  showCountdown: boolean("show_countdown").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  // Master switch: lets an admin pull a campaign instantly without deleting it.
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promotion = typeof promotionsTable.$inferSelect;
