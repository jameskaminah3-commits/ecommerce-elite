import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";

// A scheduled marketing campaign (Black Friday, Christmas, a weekend flash sale…).
// While it is live — enabled and between startsAt and endsAt — the storefront
// shows a countdown banner on the homepage and, optionally, swaps the top
// announcement bar. It switches on and off by itself; no code or redeploy.
//
// A promotion can also carry a DISCOUNT. While it is live, products it covers are
// priced at that percentage off everywhere - listings, product pages, cart and
// checkout - and revert automatically the moment it ends. A product that also has
// an Offer keeps whichever discount is bigger (discounts never stack).
export const PROMOTION_THEMES = ["brand", "festive", "gold", "night"] as const;
export type PromotionTheme = (typeof PROMOTION_THEMES)[number];

// What a promotion's discount applies to.
export const PROMOTION_SCOPES = ["all", "categories", "products"] as const;
export type PromotionScope = (typeof PROMOTION_SCOPES)[number];

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
  // 0 = banner only (no price change). 1-90 = take this % off the covered products.
  discountPercent: integer("discount_percent").notNull().default(0),
  scope: text("scope", { enum: PROMOTION_SCOPES }).notNull().default("all"),
  // For scope = categories: a category covers all of its subcategories too.
  categoryIds: integer("category_ids").array().notNull().default([]),
  // For scope = products.
  productIds: integer("product_ids").array().notNull().default([]),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  // Master switch: lets an admin pull a campaign instantly without deleting it.
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promotion = typeof promotionsTable.$inferSelect;
