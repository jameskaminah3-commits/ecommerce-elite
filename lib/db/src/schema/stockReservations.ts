import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { ordersTable } from "./orders";
import { productVariantsTable } from "./productVariants";

// Short-lived holds placed on variant stock the moment an order is created, so
// two shoppers racing for the last unit can't both check out. Available stock
// for a variant = physical stock − SUM(active, non-expired reservations).
//
// Lifecycle:
//   active   — holding stock; counts against availability until expiresAt.
//   consumed — payment confirmed; the hold became a real stock decrement.
//   released — abandoned/failed; no longer counts (also happens lazily on
//              expiry, since availability queries filter by expiresAt).
export const stockReservationsTable = pgTable(
  "stock_reservations",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").notNull().references(() => productVariantsTable.id),
    quantity: integer("quantity").notNull(),
    status: text("status", { enum: ["active", "consumed", "released"] }).notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    variantStatusIdx: index("stock_res_variant_status_idx").on(t.variantId, t.status),
    orderIdx: index("stock_res_order_idx").on(t.orderId),
  }),
);

export type StockReservation = typeof stockReservationsTable.$inferSelect;
