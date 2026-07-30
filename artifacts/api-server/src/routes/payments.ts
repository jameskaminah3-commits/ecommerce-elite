import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import {
  InitiateMpesaPaymentBody,
  InitiatePesapalPaymentBody,
  GetPaymentStatusParams,
  MpesaCallbackBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── M-PESA STK Push (Stub — wire real Daraja API keys when ready) ─────────
router.post("/payments/mpesa/initiate", async (req, res): Promise<void> => {
  const parsed = InitiateMpesaPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // STUB: In production, call Safaricom Daraja STK Push API here.
  // Required env vars (add when ready): MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET,
  // MPESA_PASSKEY, MPESA_SHORTCODE, MPESA_CALLBACK_URL
  const checkoutRequestId = `stub_${Date.now()}`;
  logger.info({ orderId: parsed.data.orderId, phone: parsed.data.phoneNumber }, "M-Pesa STK Push stub initiated");

  // Store the checkout request ID for later verification
  await db.update(ordersTable).set({ mpesaCheckoutRequestId: checkoutRequestId }).where(eq(ordersTable.id, parsed.data.orderId));

  res.json({
    success: true,
    message: "STK Push sent to your phone. Enter your M-Pesa PIN to complete payment.",
    checkoutRequestId,
    redirectUrl: null,
  });
});

// M-Pesa callback webhook (called by Safaricom)
router.post("/payments/mpesa/callback", async (req, res): Promise<void> => {
  const parsed = MpesaCallbackBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const callback = (parsed.data.Body as any)?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  const resultCode = callback?.ResultCode;

  if (checkoutRequestId) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.mpesaCheckoutRequestId, checkoutRequestId));
    if (order) {
      if (resultCode === 0) {
        // Payment successful
        await db.update(ordersTable).set({
          paymentStatus: "paid",
          status: "confirmed",
          paidAt: new Date(),
        }).where(eq(ordersTable.id, order.id));
        logger.info({ orderId: order.id }, "M-Pesa payment confirmed");
      } else {
        await db.update(ordersTable).set({ paymentStatus: "failed" }).where(eq(ordersTable.id, order.id));
        logger.warn({ orderId: order.id, resultCode }, "M-Pesa payment failed");
      }
    }
  }

  res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ── Pesapal (Stub — wire real Pesapal keys when ready) ───────────────────
router.post("/payments/pesapal/initiate", async (req, res): Promise<void> => {
  const parsed = InitiatePesapalPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.orderId));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  // STUB: In production, call Pesapal IPN/payment API here.
  // Required env vars (add when ready): PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET
  logger.info({ orderId: parsed.data.orderId }, "Pesapal payment stub initiated");

  res.json({
    success: true,
    message: "Redirecting to Pesapal payment page...",
    checkoutRequestId: null,
    redirectUrl: `https://www.pesapal.com/iframe/stubpayment?order=${parsed.data.orderId}`,
  });
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
