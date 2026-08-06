import { pgTable, serial, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryLocationsTable = pgTable("delivery_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeliveryLocationSchema = createInsertSchema(deliveryLocationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;
export type DeliveryLocation = typeof deliveryLocationsTable.$inferSelect;
