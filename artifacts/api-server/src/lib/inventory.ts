import { and, eq, gte, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productVariantsTable } from "@workspace/db";
import { syncProductToSearchInBackground } from "./meilisearch";
import { logger } from "./logger";

// Deduct stock for an order exactly once, atomically.
//
// Called when an order becomes committed: at creation for cash-on-delivery, and
// on payment confirmation for M-Pesa/Paystack. Idempotent via
// orders.inventoryDeducted, which is flipped inside the same transaction as the
// decrement — so a webhook that fires twice (or a verify racing the webhook)
// can't double-deduct. The per-variant update is conditional on
// `stock >= quantity`, so a race for the last unit can't drive stock negative;
// if a line can't be fully satisfied we log a possible oversell for an admin to
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

    await tx.update(ordersTable).set({ inventoryDeducted: true }).where(eq(ordersTable.id, orderId));
    return touched;
  });

  // Re-index the affected products outside the transaction.
  for (const productId of touchedProductIds) syncProductToSearchInBackground(productId);
}
