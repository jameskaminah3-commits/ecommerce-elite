import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Email captured from the storefront newsletter form.
export const newsletterSignupsTable = pgTable("newsletter_signups", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsletterSignup = typeof newsletterSignupsTable.$inferSelect;
