import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

// Email captured from the storefront newsletter form. Each new subscriber gets a
// personal, single-use welcome discount code for their first order.
export const newsletterSignupsTable = pgTable("newsletter_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  code: text("code").unique(),
  discountPercent: integer("discount_percent").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedOrderId: integer("used_order_id"),
  unsubscribeToken: text("unsubscribe_token"),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  lastEmailedAt: timestamp("last_emailed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsletterSignup = typeof newsletterSignupsTable.$inferSelect;
