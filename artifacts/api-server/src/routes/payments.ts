import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable, orderItemsTable } from "@workspace/db";
import { GetPaymentStatusParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { normalizeKenyanMsisdn } from "../lib/phone";
import {
  isPaystackConfigured,
  initializeTransaction,
  chargeMobileMoney,
  verifyTransaction,
  verifyWebhookSignature,
} from "../lib/paystack";
import { sendOrderPaidEmail, type OrderEmailData } from "../lib/email";
import { deductInventoryForOrder, releaseReservationsForOrder } from "../lib/inventory";

const router: IRouter = Router();

type OrderRow = typeof ordersTable.$inferSelect;

// Build the data an order-paid email needs, then send it (fire-and-forget).
async function emailOrderPaid(order: OrderRow): Promise<void> {
  if (!order.customerEmail) return;
  try {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    const data: OrderEmailData = {
      orderId: order.id,
      customerName: order.customerName,
      total: parseFloat(order.total),
      deliveryFee: parseFloat(order.deliveryFee ?? "0"),
      deliveryLocation: order.deliveryLocation,
      items: items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        subtotal: parseFloat(i.subtotal),
      })),
    };
    await sendOrderPaidEmail(order.customerEmail, data);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Failed to send order-paid email");
  }
}

// Mark an order paid + confirmed once, and notify the customer. Idempotent: a
// duplicate webhook/callback for an already-paid order won't re-email.
async function markOrderPaid(order: OrderRow): Promise<void> {
  if (order.paymentStatus === "paid") return;
  const [updated] = await db
    .update(ordersTable)
    .set({ paymentStatus: "paid", status: "confirmed", paidAt: new Date() })
    .where(eq(ordersTable.id, order.id))
    .returning();
  logger.info({ orderId: order.id }, "Order marked paid");
  // Deduct stock only now that payment is confirmed. Idempotent, so a duplicate
  // webhook/verify for the same order won't double-deduct.
  try {
    await deductInventoryForOrder(order.id);
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Inventory deduction after payment failed");
  }
  if (updated) void emailOrderPaid(updated);
}

// ── Mobile money via Paystack Charge API (M-Pesa / Airtel Money) ───────────
// The customer picks "M-Pesa" or "Airtel Money" on our UI; both route through
// Paystack. We send a direct STK-style prompt to their phone. The result is
// confirmed asynchronously by the charge.success webhook (never by the browser).
router.post("/payments/paystack/charge", async (req, res): Promise<void> => {
  const orderId = Number(req.body?.orderId);
  const channel = String(req.body?.channel ?? ""); // "mpesa" | "airtel"
  if (!Number.isInteger(orderId) || (channel !== "mpesa" && channel !== "airtel")) {
    res.status(400).json({ error: "orderId and a valid channel (mpesa|airtel) are required." });
    return;
  }

  if (!isPaystackConfigured()) {
    logger.error("Mobile-money charge called but PAYSTACK_SECRET_KEY is not set");
    res.status(503).json({ error: "Mobile money payments are not available right now. Please choose another method." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.paymentStatus === "paid") {
    res.status(400).json({ error: "This order is already paid." });
    return;
  }

  const msisdn = normalizeKenyanMsisdn(String(req.body?.phone ?? order.customerPhone ?? ""));
  if (!msisdn) {
    res.status(400).json({ error: "Enter a valid Kenyan phone number (e.g. 07XX XXX XXX)." });
    return;
  }
  const email = order.customerEmail || String(req.body?.email ?? "").trim();
  if (!email) {
    res.status(400).json({ error: "An email address is required for mobile money payment." });
    return;
  }

  // Paystack mobile-money provider code: Safaricom M-Pesa = "mpesa", Airtel = "atl".
  const provider = channel === "airtel" ? "atl" : "mpesa";
  const reference = `HF-${order.id}-${Date.now()}`;

  try {
    const result = await chargeMobileMoney({
      email,
      amount: parseFloat(order.total),
      phone: msisdn,
      provider,
      reference,
      metadata: { orderId: order.id, channel },
    });

    await db
      .update(ordersTable)
      .set({ paystackReference: reference, paymentMethod: channel as "mpesa" | "airtel" })
      .where(eq(ordersTable.id, order.id));

    res.json({
      success: true,
      status: result.status,
      reference,
      message: result.displayText ?? "Check your phone for the payment prompt.",
    });
  } catch (err) {
    logger.error({ err, orderId: order.id, channel }, "Paystack mobile-money charge failed");
    res.status(502).json({ error: "Could not start the mobile money prompt. Please try again or pay by card." });
  }
});

// ── Paystack (card / bank) ────────────────────────────────────────────────
// Initialize a transaction for an order and return the hosted checkout URL the
// browser should redirect to.
router.post("/payments/paystack/initialize", async (req, res): Promise<void> => {
  const orderId = Number(req.body?.orderId);
  if (!Number.isInteger(orderId)) {
    res.status(400).json({ error: "orderId is required." });
    return;
  }

  if (!isPaystackConfigured()) {
    logger.error("Paystack initialize called but PAYSTACK_SECRET_KEY is not set");
    res.status(503).json({ error: "Card payments are not available right now. Please choose another method." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.paymentStatus === "paid") {
    res.status(400).json({ error: "This order is already paid." });
    return;
  }
  const email = order.customerEmail || String(req.body?.email ?? "").trim();
  if (!email) {
    res.status(400).json({ error: "An email address is required for card payment." });
    return;
  }

  // Unique per attempt so retries don't collide with a prior reference.
  const reference = `HF-${order.id}-${Date.now()}`;
  const callbackBase = (process.env["STOREFRONT_URL"] ?? "").replace(/\/+$/, "");
  const callbackUrl = callbackBase ? `${callbackBase}/orders/${order.id}?paystack=1` : undefined;

  try {
    const result = await initializeTransaction({
      email,
      amount: parseFloat(order.total),
      reference,
      callbackUrl,
      metadata: { orderId: order.id },
    });

    await db
      .update(ordersTable)
      .set({ paystackReference: result.reference, paymentMethod: "paystack" })
      .where(eq(ordersTable.id, order.id));

    res.json({ success: true, authorizationUrl: result.authorizationUrl, reference: result.reference });
  } catch (err) {
    logger.error({ err, orderId: order.id }, "Paystack initialize failed");
    res.status(502).json({ error: "Could not start card payment. Please try again." });
  }
});

// Server-to-server verification the storefront can call after the redirect
// returns, so the UI reflects payment without waiting on the webhook.
router.get("/payments/paystack/verify", async (req, res): Promise<void> => {
  const reference = String(req.query?.["reference"] ?? "");
  if (!reference) {
    res.status(400).json({ error: "reference is required." });
    return;
  }
  if (!isPaystackConfigured()) {
    res.status(503).json({ error: "Card payments are not configured." });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.paystackReference, reference));
  if (!order) {
    res.status(404).json({ error: "Order not found for reference" });
    return;
  }

  try {
    const result = await verifyTransaction(reference);
    // Guard against amount tampering: the verified amount must cover the order.
    const covers = result.amount + 0.01 >= parseFloat(order.total);
    if (result.status === "success" && covers) {
      await markOrderPaid(order);
    } else if (result.status === "failed") {
      await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
      await releaseReservationsForOrder(order.id);
    }
    const paid = (result.status === "success" && covers) || order.paymentStatus === "paid";
    res.json({ orderId: order.id, status: result.status, paymentStatus: paid ? "paid" : "pending" });
  } catch (err) {
    logger.error({ err, reference }, "Paystack verify failed");
    res.status(502).json({ error: "Could not verify payment." });
  }
});

// Paystack webhook — the authoritative source of truth. Requires a valid
// X-Paystack-Signature (HMAC-SHA512 of the raw body with the secret key).
router.post("/payments/paystack/webhook", async (req, res): Promise<void> => {
  if (!isPaystackConfigured()) {
    res.sendStatus(200);
    return;
  }
  const raw =
    (req as any).rawBody instanceof Buffer
      ? (req as any).rawBody.toString("utf8")
      : JSON.stringify(req.body ?? {});
  const signature = req.header("x-paystack-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn("Rejected Paystack webhook with invalid signature");
    res.sendStatus(401);
    return;
  }

  const event = req.body?.event;
  const data = req.body?.data;
  if (event === "charge.success" && data?.reference) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.paystackReference, data.reference));
    if (order && (data.amount ?? 0) / 100 + 0.01 >= parseFloat(order.total)) {
      await markOrderPaid(order);
    }
  }

  res.sendStatus(200);
});

// ── Payment status query ──────────────────────────────────────────────────
router.get("/payments/:orderId/status", async (req, res): Promise<void> => {
  const params = GetPaymentStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, params.data.orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json({
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paidAt: order.paidAt?.toISOString() ?? null,
  });
});

export default router;
