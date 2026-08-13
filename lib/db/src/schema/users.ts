import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // Nullable so accounts created via Google or email-OTP (which have no
  // password) can exist. Password logins require this to be set.
  passwordHash: text("password_hash"),
  phone: text("phone"),
  role: text("role", { enum: ["customer", "admin", "warehouse"] }).notNull().default("customer"),
  // Set when a Google account is linked, so returning Google sign-ins map to the
  // same user even if they later change their Google email.
  googleId: text("google_id").unique(),
  // True once the email has been proven (Google sign-in, or a verified OTP).
  emailVerified: boolean("email_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
