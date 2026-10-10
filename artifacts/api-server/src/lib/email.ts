import { logger } from "./logger";

// Transactional email via Resend (https://resend.com). We call the REST API
// directly with fetch so there's no extra dependency to bundle.
//
// Required env:
//   RESEND_API_KEY      — your Resend API key (starts with `re_`)
//   RESEND_FROM         — verified sender, e.g. "Happyfine <orders@happyfine.co.ke>"
// Optional env:
//   ADMIN_ORDER_EMAILS  — comma-separated addresses that get every new-order alert
//                         (in addition to the list saved in Admin → Footer & payments)
//   RESEND_API_URL      — override the API endpoint (used by tests)
//
// If RESEND_API_KEY is unset (e.g. local dev) we log and no-op instead of
// throwing, so order/OTP flows still work without an email provider wired up.

const DEFAULT_RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env["RESEND_API_KEY"]);
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] ?? "Happyfine <onboarding@resend.dev>";
  const to = Array.isArray(input.to) ? input.to : [input.to];

  if (!apiKey) {
    logger.warn({ to, subject: input.subject }, "RESEND_API_KEY not set — skipping email send");
    return false;
  }
  if (to.length === 0) return false;

  try {
    const res = await fetch(process.env["RESEND_API_URL"] || DEFAULT_RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, body, to }, "Resend email send failed");
      return false;
    }
    logger.info({ to, subject: input.subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err, to }, "Resend email send threw");
    return false;
  }
}

// ── Templated emails ──────────────────────────────────────────────────────

const BRAND = "Happyfine Wholesalers";

// Customer-supplied text (names, addresses, notes) goes into HTML emails — including
// the ones sent to the shop team — so it must always be escaped.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-weight:800;font-size:20px;letter-spacing:-0.02em;margin-bottom:24px;">${BRAND}</div>
    <div style="background:#ffffff;border:1px solid #ececea;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${esc(title)}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#9a9a95;font-size:12px;margin-top:24px;text-align:center;">Wholesale prices for everyone, delivered across Kenya.</p>
  </div>
  </body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:22px 0 0;"><a href="${esc(href)}" style="display:inline-block;background:#e8430f;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;">${esc(label)}</a></p>`;
}

function currencyKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const html = shell(
    "Your sign-in code",
    `<p style="margin:0 0 16px;color:#555;">Use this code to sign in. It expires in 10 minutes.</p>
     <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f6f6f4;border-radius:12px;padding:18px 0;margin:8px 0 16px;">${esc(code)}</div>
     <p style="margin:0;color:#9a9a95;font-size:13px;">If you didn't request this, you can ignore this email.</p>`,
  );
  return sendEmail({
    to,
    subject: `${code} is your ${BRAND} sign-in code`,
    html,
    text: `Your ${BRAND} sign-in code is ${code}. It expires in 10 minutes.`,
  });
}

export interface OrderEmailItem {
  productName: string;
  quantity: number;
  subtotal: number;
}

export interface OrderEmailData {
  orderId: number;
  customerName: string;
  total: number;
  deliveryFee: number;
  deliveryLocation?: string | null;
  items: OrderEmailItem[];
  // Extra detail used by the shop-team alerts.
  customerPhone?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  paymentMethodLabel?: string | null;
  paymentPaid?: boolean;
  referralDiscount?: number;
}

// Where and how to pay by hand — the admin's M-Pesa details.
export interface ManualPaymentInfo {
  phone?: string;
  till?: string;
  paybill?: string;
  accountName?: string;
  instructions?: string;
}

function orderRows(items: OrderEmailItem[]): string {
  return items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0ee;">${esc(i.productName)} <span style="color:#9a9a95;">× ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #f0f0ee;text-align:right;">${currencyKES(i.subtotal)}</td></tr>`,
    )
    .join("");
}

function totalsRows(data: OrderEmailData): string {
  return `${data.referralDiscount ? `<tr><td style="padding:8px 0;color:#0a7a45;">Referral discount</td><td style="padding:8px 0;text-align:right;color:#0a7a45;">−${currencyKES(data.referralDiscount)}</td></tr>` : ""}
       <tr><td style="padding:8px 0;color:#9a9a95;">Delivery${data.deliveryLocation ? ` (${esc(data.deliveryLocation)})` : ""}</td><td style="padding:8px 0;text-align:right;color:#9a9a95;">${currencyKES(data.deliveryFee)}</td></tr>
       <tr><td style="padding:12px 0 0;font-weight:800;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:800;">${currencyKES(data.total)}</td></tr>`;
}

// "Send money to 0712… (Jane Doe)" — the pay-by-hand block, for the customer's email.
function manualPaymentBlock(data: OrderEmailData, m: ManualPaymentInfo): string {
  const lines: string[] = [];
  if (m.phone) lines.push(`<strong>Send Money</strong> to <strong>${esc(m.phone)}</strong>${m.accountName ? ` (${esc(m.accountName)})` : ""}`);
  if (m.till) lines.push(`<strong>Buy Goods</strong> — Till number <strong>${esc(m.till)}</strong>${m.accountName && !m.phone ? ` (${esc(m.accountName)})` : ""}`);
  if (m.paybill) lines.push(`<strong>Pay Bill</strong> — Business number <strong>${esc(m.paybill)}</strong>, account <strong>${esc(m.accountName || `Order ${data.orderId}`)}</strong>`);
  if (lines.length === 0) return "";
  return `<div style="margin:20px 0 4px;padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;">
      <p style="margin:0 0 8px;font-weight:800;">How to pay ${currencyKES(data.total)}</p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.6;">${lines.join("<br>")}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#555;">Use <strong>Order #${data.orderId}</strong> as the reference. When you get the M-Pesa confirmation SMS, enter its code on your order page so we can confirm your payment.${m.instructions ? `<br>${esc(m.instructions)}` : ""}</p>
    </div>`;
}

export async function sendOrderReceivedEmail(
  to: string,
  data: OrderEmailData,
  opts: { manual?: ManualPaymentInfo | null; orderUrl?: string } = {},
): Promise<boolean> {
  const html = shell(
    `Order #${data.orderId} received`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${esc(data.customerName)}, thanks for your order. We'll confirm it as soon as your payment is received.</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}${totalsRows(data)}</table>
     ${opts.manual ? manualPaymentBlock(data, opts.manual) : ""}
     ${opts.orderUrl ? button(opts.orderUrl, opts.manual ? "Enter your M-Pesa code" : "View your order") : ""}`,
  );
  return sendEmail({ to, subject: `Order #${data.orderId} received — ${BRAND}`, html });
}

export async function sendOrderPaidEmail(to: string, data: OrderEmailData): Promise<boolean> {
  const html = shell(
    `Payment confirmed for order #${data.orderId}`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${esc(data.customerName)}, we've received your payment of <strong>${currencyKES(data.total)}</strong>. Your order is now being prepared for delivery${data.deliveryLocation ? ` to ${esc(data.deliveryLocation)}` : ""}.</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}
       <tr><td style="padding:12px 0 0;font-weight:800;">Total paid</td><td style="padding:12px 0 0;text-align:right;font-weight:800;">${currencyKES(data.total)}</td></tr>
     </table>`,
  );
  return sendEmail({ to, subject: `Payment confirmed — order #${data.orderId}`, html });
}

// Customer: "we got your M-Pesa code, we're checking it".
export async function sendPaymentCodeReceivedEmail(to: string, data: OrderEmailData, code: string): Promise<boolean> {
  const html = shell(
    `We received your M-Pesa code`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${esc(data.customerName)}, thanks — we've received the M-Pesa code <strong style="font-family:monospace;">${esc(code)}</strong> for order <strong>#${data.orderId}</strong> (${currencyKES(data.total)}).</p>
     <p style="margin:0;color:#555;">Our team is verifying it now. You'll get another email as soon as your payment is confirmed.</p>`,
  );
  return sendEmail({ to, subject: `We received your payment code — order #${data.orderId}`, html });
}

// ── Shop-team alerts ──────────────────────────────────────────────────────

export type AdminOrderEvent = "placed" | "code" | "paid";

// One alert to everyone on the notification list. `placed` fires for every new
// order; `code` when a customer submits an M-Pesa code to verify; `paid` when an
// online payment lands.
export async function sendAdminOrderEmail(
  recipients: string[],
  data: OrderEmailData,
  event: AdminOrderEvent,
  ctx: { adminUrl?: string; code?: string } = {},
): Promise<boolean> {
  if (recipients.length === 0) return false;
  const paid = data.paymentPaid === true;
  const heading =
    event === "code" ? `Verify payment — order #${data.orderId}`
    : event === "paid" ? `Order #${data.orderId} paid — ready to fulfil`
    : `New order #${data.orderId}`;
  const status = paid ? "Paid" : event === "code" ? "Code submitted — needs verifying" : "Awaiting payment";
  const subject =
    event === "code" ? `Verify M-Pesa payment ${ctx.code ?? ""} — order #${data.orderId} (${currencyKES(data.total)})`.replace("  ", " ")
    : event === "paid" ? `Paid: order #${data.orderId} — ${currencyKES(data.total)}`
    : `New order #${data.orderId} — ${currencyKES(data.total)} · ${data.paymentMethodLabel ?? "payment pending"}`;

  const cell = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#9a9a95;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;">${value}</td></tr>`;

  const html = shell(
    heading,
    `${event === "code" && ctx.code ? `<div style="margin:0 0 16px;padding:14px 16px;background:#f6f6f4;border-radius:12px;text-align:center;"><div style="color:#9a9a95;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">M-Pesa code</div><div style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:3px;">${esc(ctx.code)}</div><div style="color:#555;font-size:13px;">for ${currencyKES(data.total)} · check it against your M-Pesa statement</div></div>` : ""}
     <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">
       ${cell("Customer", esc(data.customerName))}
       ${data.customerPhone ? cell("Phone", `<a href="tel:${esc(data.customerPhone)}" style="color:#e8430f;">${esc(data.customerPhone)}</a>`) : ""}
       ${data.customerEmail ? cell("Email", esc(data.customerEmail)) : ""}
       ${data.shippingAddress ? cell("Deliver to", `${esc(data.shippingAddress)}${data.deliveryLocation ? `, ${esc(data.deliveryLocation)}` : ""}`) : ""}
       ${cell("Payment", `${esc(data.paymentMethodLabel ?? "—")} · <strong>${esc(status)}</strong>`)}
     </table>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}${totalsRows(data)}</table>
     ${ctx.adminUrl ? button(ctx.adminUrl, event === "code" ? "Verify & mark paid" : "Open in admin") : ""}`,
  );
  return sendEmail({ to: recipients, subject, html });
}
