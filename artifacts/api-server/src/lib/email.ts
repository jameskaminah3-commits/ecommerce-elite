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
  discountAmount?: number;
  discountCode?: string | null;
}

// Where and how to pay by hand — the admin's M-Pesa details.
export interface ManualPaymentInfo {
  pochi?: string;
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
  return `${data.discountAmount ? `<tr><td style="padding:8px 0;color:#0a7a45;">Discount${data.discountCode ? ` (${esc(data.discountCode)})` : ""}</td><td style="padding:8px 0;text-align:right;color:#0a7a45;">−${currencyKES(data.discountAmount)}</td></tr>` : ""}${data.referralDiscount ? `<tr><td style="padding:8px 0;color:#0a7a45;">Referral discount</td><td style="padding:8px 0;text-align:right;color:#0a7a45;">−${currencyKES(data.referralDiscount)}</td></tr>` : ""}
       <tr><td style="padding:8px 0;color:#9a9a95;">Delivery${data.deliveryLocation ? ` (${esc(data.deliveryLocation)})` : ""}</td><td style="padding:8px 0;text-align:right;color:#9a9a95;">${currencyKES(data.deliveryFee)}</td></tr>
       <tr><td style="padding:12px 0 0;font-weight:800;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:800;">${currencyKES(data.total)}</td></tr>`;
}

// "Send money to 0712… (Jane Doe)" — the pay-by-hand block, for the customer's email.
// "How to pay" exactly as it reads on the customer's phone (Safaricom M-PESA menu).
function manualPaymentBlock(data: OrderEmailData, m: ManualPaymentInfo): string {
  const amount = currencyKES(data.total);
  const name = m.accountName ? ` — confirm the name <strong>${esc(m.accountName.toUpperCase())}</strong>` : "";
  const ways: string[] = [];
  if (m.pochi) ways.push(`<strong>Pochi la Biashara</strong><br>M-PESA › Lipa na M-PESA › Pochi la Biashara › enter <strong>${esc(m.pochi)}</strong> › amount <strong>${amount}</strong> › PIN${name}`);
  if (m.till) ways.push(`<strong>Buy Goods (Till)</strong><br>M-PESA › Lipa na M-PESA › Buy Goods and Services › Till <strong>${esc(m.till)}</strong> › amount <strong>${amount}</strong> › PIN${name}`);
  if (m.paybill) ways.push(`<strong>Paybill</strong><br>M-PESA › Lipa na M-PESA › Pay Bill › Business no. <strong>${esc(m.paybill)}</strong> › Account <strong>${data.orderId}</strong> › amount <strong>${amount}</strong> › PIN`);
  if (m.phone) ways.push(`<strong>Send Money</strong><br>M-PESA › Send Money › <strong>${esc(m.phone)}</strong> › amount <strong>${amount}</strong> › PIN${name}`);
  if (ways.length === 0) return "";
  return `<div style="margin:20px 0 4px;padding:16px 18px;background:#f0faf3;border:1px solid #cdebd6;border-radius:12px;">
      <p style="margin:0 0 10px;font-weight:800;color:#14532d;">Pay ${amount} with Lipa na M-PESA</p>
      ${ways.map((w) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;">${w}</p>`).join("")}
      <p style="margin:6px 0 0;font-size:13px;color:#555;">You'll get an M-PESA confirmation SMS — enter its code (e.g. SGH7XK9QPM) on your order page and we'll confirm your order. Your items are reserved for you.${m.instructions ? `<br>${esc(m.instructions)}` : ""}</p>
    </div>`;
}

// No payment number published yet: the team calls to confirm, like a shop taking a phone order.
function confirmCallBlock(data: OrderEmailData, contactPhone?: string): string {
  return `<div style="margin:20px 0 4px;padding:16px 18px;background:#f6f6f4;border-radius:12px;">
      <p style="margin:0 0 8px;font-weight:800;">What happens next</p>
      <p style="margin:0;font-size:14px;line-height:1.7;">1. We call you${data.customerPhone ? ` on <strong>${esc(data.customerPhone)}</strong>` : ""} to confirm your order and delivery.<br>
      2. You pay <strong>${currencyKES(data.total)}</strong> with M-PESA — we'll share our business details on the call.<br>
      3. We dispatch your order and send you a confirmation.</p>
      ${contactPhone ? `<p style="margin:10px 0 0;font-size:13px;color:#555;">Questions? Call or WhatsApp us on <strong>${esc(contactPhone)}</strong>.</p>` : ""}
    </div>`;
}

export async function sendOrderReceivedEmail(
  to: string,
  data: OrderEmailData,
  opts: { manual?: ManualPaymentInfo | null; orderUrl?: string; confirmCall?: { contactPhone?: string } | null } = {},
): Promise<boolean> {
  const intro = opts.confirmCall
    ? "thanks for your order — it's reserved for you. We'll call you shortly to confirm it."
    : "thanks for your order. We'll confirm it as soon as your payment is received.";
  const html = shell(
    `Order #${data.orderId} received`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${esc(data.customerName)}, ${intro}</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}${totalsRows(data)}</table>
     ${opts.manual ? manualPaymentBlock(data, opts.manual) : ""}
     ${opts.confirmCall ? confirmCallBlock(data, opts.confirmCall.contactPhone) : ""}
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
  ctx: { adminUrl?: string; code?: string; callCustomer?: boolean } = {},
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
    `${ctx.callCustomer ? `<div style="margin:0 0 16px;padding:14px 16px;background:#fff4ec;border:1px solid #fbd5bd;border-radius:12px;"><strong>Next step: call the customer</strong><br><span style="font-size:14px;color:#555;">No M-Pesa number is published on the shop yet, so call ${data.customerPhone ? `<a href="tel:${esc(data.customerPhone)}" style="color:#e8430f;">${esc(data.customerPhone)}</a>` : "the customer"} to confirm the order and share how to pay. Tip: add your Pochi la Biashara or Till in Admin › Footer &amp; payments so customers can pay straight away.</span></div>` : ""}${event === "code" && ctx.code ? `<div style="margin:0 0 16px;padding:14px 16px;background:#f6f6f4;border-radius:12px;text-align:center;"><div style="color:#9a9a95;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">M-Pesa code</div><div style="font-family:monospace;font-size:26px;font-weight:800;letter-spacing:3px;">${esc(ctx.code)}</div><div style="color:#555;font-size:13px;">for ${currencyKES(data.total)} · check it against your M-Pesa statement</div></div>` : ""}
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

// Newsletter welcome: the personal first-order code, big and easy to copy.
export async function sendWelcomeEmail(
  to: string,
  opts: { code?: string | null; percent: number; expiresAt?: Date | null; shopUrl: string; unsubscribeUrl?: string },
): Promise<boolean> {
  const hasCode = Boolean(opts.code && opts.percent > 0);
  const until = opts.expiresAt
    ? opts.expiresAt.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Nairobi" })
    : null;
  const html = shell(
    hasCode ? `Here's ${opts.percent}% off your first order` : "Welcome to the list",
    `<p style="margin:0 0 16px;color:#555;">Thanks for joining! You'll be first to hear about deals and new arrivals — all at wholesale prices, no minimum order.</p>
     ${hasCode ? `<div style="text-align:center;background:#f6f6f4;border:1px dashed #d6d6d2;border-radius:12px;padding:18px 12px;margin:8px 0 12px;">
        <div style="color:#9a9a95;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Your code</div>
        <div style="font-family:monospace;font-size:28px;font-weight:800;letter-spacing:3px;margin-top:4px;">${esc(opts.code)}</div>
        <div style="color:#555;font-size:13px;margin-top:6px;">${opts.percent}% off your first order${until ? ` · valid until ${esc(until)}` : ""}</div>
      </div>
      <p style="margin:0;color:#555;font-size:14px;">Enter it at checkout in the <strong>Discount code</strong> box. One use, on your first order.</p>` : ""}
     ${button(opts.shopUrl, "Start shopping")}
     ${opts.unsubscribeUrl ? `<p style="margin:22px 0 0;color:#9a9a95;font-size:12px;">Don't want these emails? <a href="${esc(opts.unsubscribeUrl)}" style="color:#9a9a95;">Unsubscribe</a>.</p>` : ""}`,
  );
  return sendEmail({
    to,
    subject: hasCode ? `Your ${opts.percent}% welcome code: ${opts.code}` : `Welcome to ${BRAND}`,
    html,
    text: hasCode
      ? `Thanks for joining ${BRAND}! Your code ${opts.code} gives ${opts.percent}% off your first order${until ? ` (valid until ${until})` : ""}. Shop: ${opts.shopUrl}`
      : `Thanks for joining ${BRAND}! Shop: ${opts.shopUrl}`,
  });
}

// New account: a warm hello and what the account is for.
export async function sendAccountWelcomeEmail(to: string, opts: { name: string; shopUrl: string; accountUrl: string }): Promise<boolean> {
  const first = (opts.name || "").trim().split(/\s+/)[0] || "there";
  const html = shell(
    `Welcome, ${first}!`,
    `<p style="margin:0 0 14px;color:#555;">Your ${BRAND} account is ready. Everything in the shop is at wholesale prices — and you can buy just one.</p>
     <ul style="margin:0 0 6px;padding-left:18px;color:#555;font-size:14px;line-height:1.8;">
       <li>Track your orders and payments in one place</li>
       <li>Faster checkout — your details are filled in</li>
       <li>Rate products you've bought</li>
     </ul>
     ${button(opts.shopUrl, "Start shopping")}
     <p style="margin:16px 0 0;font-size:13px;color:#9a9a95;">Your account: <a href="${esc(opts.accountUrl)}" style="color:#9a9a95;">${esc(opts.accountUrl)}</a></p>`,
  );
  return sendEmail({ to, subject: `Welcome to ${BRAND}`, html, text: `Welcome, ${first}! Your ${BRAND} account is ready. Shop: ${opts.shopUrl}` });
}
