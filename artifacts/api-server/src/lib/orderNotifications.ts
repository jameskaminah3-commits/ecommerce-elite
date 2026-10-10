import { eq } from "drizzle-orm";
import { db, orderItemsTable, ordersTable } from "@workspace/db";
import { logger } from "./logger";
import {
  sendAdminOrderEmail,
  sendOrderReceivedEmail,
  sendPaymentCodeReceivedEmail,
  type AdminOrderEvent,
  type ManualPaymentInfo,
  type OrderEmailData,
} from "./email";
import { getSettingsRow } from "./paymentOptions";

type OrderRow = typeof ordersTable.$inferSelect;

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa (STK push)",
  mpesa_manual: "M-Pesa (paid manually)",
  airtel: "Airtel Money",
  card: "Card / bank",
  paystack: "Card / bank",
  pesapal: "Pesapal",
  cash_on_delivery: "Cash on delivery",
};

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function parseEmailList(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => EMAIL_RE.test(s));
}

// Everyone who should hear about orders: the ADMIN_ORDER_EMAILS env var plus the
// list saved in admin; falling back to the shop's public contact email so a
// forgotten setting still results in *someone* being told.
export async function adminRecipients(): Promise<string[]> {
  const settings = await getSettingsRow();
  const list = new Set<string>([
    ...parseEmailList(process.env["ADMIN_ORDER_EMAILS"]),
    ...parseEmailList(settings?.orderNotifyEmails),
  ]);
  if (list.size === 0) parseEmailList(settings?.contactEmail).forEach((e) => list.add(e));
  return [...list];
}

async function buildData(order: OrderRow): Promise<OrderEmailData> {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  return {
    orderId: order.id,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress,
    total: parseFloat(order.total),
    deliveryFee: parseFloat(order.deliveryFee ?? "0"),
    deliveryLocation: order.deliveryLocation,
    referralDiscount: parseFloat(order.referralDiscount ?? "0") || 0,
    paymentMethodLabel: METHOD_LABELS[order.paymentMethod ?? ""] ?? order.paymentMethod ?? null,
    paymentPaid: order.paymentStatus === "paid",
    items: items.map((i) => ({ productName: i.productName, quantity: i.quantity, subtotal: parseFloat(i.subtotal) })),
  };
}

function manualInfo(settings: Awaited<ReturnType<typeof getSettingsRow>>): ManualPaymentInfo | null {
  if (!settings) return null;
  const info: ManualPaymentInfo = {
    phone: settings.mpesaSendPhone || undefined,
    till: settings.mpesaTill || undefined,
    paybill: settings.mpesaPaybill || undefined,
    accountName: settings.mpesaAccountName || undefined,
    instructions: settings.mpesaInstructions || undefined,
  };
  return info.phone || info.till || info.paybill ? info : null;
}

// Fire-and-forget wrapper: an email problem must never fail or slow an order.
function safely(label: string, p: Promise<unknown>): void {
  p.catch((err) => logger.error({ err, label }, "Order notification failed"));
}

// A new order was placed: tell the shop team, and email the customer a receipt
// (with how-to-pay instructions when they chose to pay by hand).
export function notifyOrderPlaced(order: OrderRow, siteUrl: string): void {
  safely("order-placed", (async () => {
    const [data, settings, recipients] = await Promise.all([buildData(order), getSettingsRow(), adminRecipients()]);
    const manual = order.paymentMethod === "mpesa_manual" ? manualInfo(settings) : null;
    await Promise.all([
      sendAdminOrderEmail(recipients, data, "placed", { adminUrl: `${siteUrl}/admin/orders` }),
      order.customerEmail
        ? sendOrderReceivedEmail(order.customerEmail, data, { manual, orderUrl: manual ? `${siteUrl}/orders/${order.id}` : undefined })
        : Promise.resolve(false),
    ]);
  })());
}

// The customer typed in their M-Pesa code: ask the team to verify it, reassure the customer.
export function notifyPaymentCode(order: OrderRow, code: string, siteUrl: string): void {
  safely("payment-code", (async () => {
    const [data, recipients] = await Promise.all([buildData(order), adminRecipients()]);
    await Promise.all([
      sendAdminOrderEmail(recipients, data, "code", { adminUrl: `${siteUrl}/admin/orders?filter=verify`, code }),
      order.customerEmail ? sendPaymentCodeReceivedEmail(order.customerEmail, data, code) : Promise.resolve(false),
    ]);
  })());
}

// An online payment landed (webhook/verify): tell the team it's ready to fulfil.
export function notifyAdminPaid(order: OrderRow, siteUrl: string, event: AdminOrderEvent = "paid"): void {
  safely("order-paid", (async () => {
    const [data, recipients] = await Promise.all([buildData({ ...order, paymentStatus: "paid" }), adminRecipients()]);
    await sendAdminOrderEmail(recipients, data, event, { adminUrl: `${siteUrl}/admin/orders?filter=fulfil` });
  })());
}

// Base URL for links inside emails when there's no request (webhooks).
export function configuredSiteUrl(): string {
  return (process.env["PUBLIC_URL"] ?? "").trim().replace(/\/+$/, "");
}
