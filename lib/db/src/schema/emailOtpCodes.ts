import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

// One-time codes for passwordless email login. We store only a hash of the
// code (never the plaintext), a short expiry, and an attempt counter so a code
// can't be brute-forced. Rows are single-use: `consumedAt` is stamped the
// moment a code verifies.
export const emailOtpCodesTable = pgTable("email_otp_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailOtpCode = typeof emailOtpCodesTable.$inferSelect;
