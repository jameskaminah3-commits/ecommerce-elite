import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { categoriesTable } from "./categories";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
  compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  imageUrl: text("image_url"),
  images: text("images").array().notNull().default([]),
  status: text("status", { enum: ["active", "inactive", "draft"] }).notNull().default("active"),
  featured: boolean("featured").notNull().default(false),
  // Active promotional discount (0-90). Applied to the charged price at checkout.
  discountPercent: integer("discount_percent").notNull().default(0),
  // Delivery class (null = Standard/base town rate). Drives per-town shipping cost.
  deliveryClassId: integer("delivery_class_id"),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
