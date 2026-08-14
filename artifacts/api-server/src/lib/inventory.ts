import { and, eq, gt, gte, sql } from "drizzle-orm";
import {
  db,
  ordersTable,
  orderItemsTable,
  productVariantsTable,
  stockReservationsTable,
} from "@workspace/db";
import { syncProductToSearchInBackground } from "./meilisearch";
import { logger } from "./logger";

// The drizzle transaction handle type, so helpers can run inside a caller's tx.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Thrown when a line can't be reserved. The route maps it to a 400 with the
// product name so the shopper knows what's unavailable.
export class InsufficientStockError extends Error {
  constructor(public productName: string) {
    super(`Insufficient stock for ${productName}`);
    this.name = "InsufficientStockError";
  }
}

// How long a hold survives before it's ignored and the stock frees up. Kept a
// little longer than a typical M-Pesa STK / card-checkout attempt.
export function reservationTtlMs(): number {
  const minutes = Number(process.env["STOCK_RESERVATION_TTL_MINUTES"]);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60 * 1000;
}

export interface ReservationLine {
  variantId: number;
  quantity: number;
  productName: string;
}

// Reserve stock for each line inside the caller's transaction. Locks each
// variant row, checks availability against physical stock minus other active,
// non-expired reservations, and inserts the hold rows. Throws
// InsufficientStockError (rolling back the tx) if any line can't be satisfied.
export async function reserveStockForOrder(
  tx: Tx,
  orderId: number,
  lines: ReservationLine[],
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + reservationTtlMs());

  for (const line of lines) {
    // Lock the variant row so concurrent checkouts serialise on this variant.
    const [variant] = await tx
      .select()
      .from(productVariantsTable)
      .where(eq(productVariantsTable.id, line.variantId))
      .for("update");
    if (!variant) throw new InsufficientStockError(line.productName);

    const [{ reserved }] = await tx
      .select({
        reserved: sql<number>`cast(coalesce(sum(${stockReservationsTable.quantity}), 0) as int)`,
      })
      .from(stockReservationsTable)
      .where(
        and(
          eq(stockReservationsTable.variantId, line.variantId),
          eq(stockReservationsTable.status, "active"),
          gt(stockReservationsTable.expiresAt, now),
        ),
      );

    if (variant.stock - reserved < line.quantity) {
      throw new InsufficientStockError(line.productName);
    }

    await tx.insert(stockReservationsTable).values({
      orderId,
      variantId: line.variantId,
      quantity: line.quantity,
      status: "active",
      expiresAt,
    });
  }
}

// Release an order's active holds (e.g. payment failed/abandoned) so the stock
// is available again immediately instead of waiting for expiry.
export async function releaseReservationsForOrder(orderId: number): Promise<void> {
  await db
    .update(stockReservationsTable)
    .set({ status: "released" })
    .where(
      and(eq(stockReservationsTable.orderId, orderId), eq(stockReservationsTable.status, "active")),
    );
}

// Deduct stock for an order exactly once, atomically, and consume its holds.
//
// Called when an order becomes committed: at creation for cash-on-delivery, and
// on payment confirmation for M-Pesa/Paystack. Idempotent via
// orders.inventoryDeducted, flipped inside the same transaction as the
// decrement — so a webhook that fires twice can't double-deduct. The per-variant
// update is conditional on `stock >= quantity`, so it can't drive stock
// negative; an unsatisfiable line logs a possible oversell for an admin to
// reconcile rather than failing the (already paid) order.
export async function deductInventoryForOrder(orderId: number): Promise<void> {
  const touchedProductIds = await db.transaction(async (tx) => {
    // Lock the order row so concurrent callers serialise on the flag check.
    const [order] = await tx
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, orderId))
      .for("update");
    if (!order || order.inventoryDeducted) return [];

    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    const touched: number[] = [];
    for (const item of items) {
      const updated = await tx
        .update(productVariantsTable)
        .set({ stock: sql`${productVariantsTable.stock} - ${item.quantity}` })
        .where(
          and(
            eq(productVariantsTable.id, item.variantId),
            gte(productVariantsTable.stock, item.quantity),
          ),
        )
        .returning({ productId: productVariantsTable.productId });
      if (updated.length === 0) {
        logger.warn(
          { orderId, variantId: item.variantId, quantity: item.quantity },
          "Insufficient stock at deduction time — possible oversell to reconcile",
        );
      } else {
        touched.push(updated[0].productId);
      }
    }

    // The holds are now realised as an actual stock decrement.
    await tx
      .update(stockReservationsTable)
      .set({ status: "consumed" })
      .where(
        and(
          eq(stockReservationsTable.orderId, orderId),
          eq(stockReservationsTable.status, "active"),
        ),
      );

    await tx.update(ordersTable).set({ inventoryDeducted: true }).where(eq(ordersTable.id, orderId));
    return touched;
  });

  // Re-index the affected products outside the transaction.
  for (const productId of touchedProductIds) syncProductToSearchInBackground(productId);
}
