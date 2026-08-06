import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const deliveryClassesTable = pgTable("delivery_classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDeliveryClassSchema = createInsertSchema(deliveryClassesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliveryClass = z.infer<typeof insertDeliveryClassSchema>;
export type DeliveryClass = typeof deliveryClassesTable.$inferSelect;
