import { pgTable, serial, integer, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { deliveryLocationsTable } from "./deliveryLocations";
import { deliveryClassesTable } from "./deliveryClasses";

// Cost to deliver a given delivery class to a given town. When no row exists
// for a (location, class) pair, the town's base cost applies as the fallback.
export const deliveryRatesTable = pgTable(
  "delivery_rates",
  {
    id: serial("id").primaryKey(),
    locationId: integer("location_id").notNull().references(() => deliveryLocationsTable.id, { onDelete: "cascade" }),
    classId: integer("class_id").notNull().references(() => deliveryClassesTable.id, { onDelete: "cascade" }),
    cost: numeric("cost", { precision: 12, scale: 2 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => ({
    uniqueLocationClass: unique("delivery_rates_location_class_unique").on(t.locationId, t.classId),
  }),
);

export const insertDeliveryRateSchema = createInsertSchema(deliveryRatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliveryRate = z.infer<typeof insertDeliveryRateSchema>;
export type DeliveryRate = typeof deliveryRatesTable.$inferSelect;
