import { logger } from "./logger";

// Transactional email via Resend (https://resend.com). We call the REST API
// directly with fetch so there's no extra dependency to bundle.
//
// Required env:
//   RESEND_API_KEY   — your Resend API key (starts with `re_`)
//   RESEND_FROM      — verified sender, e.g. "Happyfine <orders@happyfine.co.ke>"
//
// If RESEND_API_KEY is unset (e.g. local dev) we log and no-op instead of
// throwing, so order/OTP flows still work without an email provider wired up.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
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

  if (!apiKey) {
    logger.warn({ to: input.to, subject: input.subject }, "RESEND_API_KEY not set — skipping email send");
    return false;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error({ status: res.status, body, to: input.to }, "Resend email send failed");
      return false;
    }
    logger.info({ to: input.to, subject: input.subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err, to: input.to }, "Resend email send threw");
    return false;
  }
}

// ── Templated emails ──────────────────────────────────────────────────────

const BRAND = "Happyfine Wholesalers";

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="font-weight:800;font-size:20px;letter-spacing:-0.02em;margin-bottom:24px;">${BRAND}</div>
    <div style="background:#ffffff;border:1px solid #ececea;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>
      ${bodyHtml}
    </div>
    <p style="color:#9a9a95;font-size:12px;margin-top:24px;text-align:center;">Wholesale prices, delivered across Kenya.</p>
  </div>
  </body></html>`;
}

function currencyKES(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;
}

export async function sendOtpEmail(to: string, code: string): Promise<boolean> {
  const html = shell(
    "Your sign-in code",
    `<p style="margin:0 0 16px;color:#555;">Use this code to sign in. It expires in 10 minutes.</p>
     <div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f6f6f4;border-radius:12px;padding:18px 0;margin:8px 0 16px;">${code}</div>
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
}

function orderRows(items: OrderEmailItem[]): string {
  return items
    .map(
      (i) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0ee;">${i.productName} <span style="color:#9a9a95;">× ${i.quantity}</span></td><td style="padding:8px 0;border-bottom:1px solid #f0f0ee;text-align:right;">${currencyKES(i.subtotal)}</td></tr>`,
    )
    .join("");
}

export async function sendOrderReceivedEmail(to: string, data: OrderEmailData): Promise<boolean> {
  const html = shell(
    `Order #${data.orderId} received`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${data.customerName}, thanks for your order. We'll confirm once payment is received.</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}
       <tr><td style="padding:8px 0;color:#9a9a95;">Delivery${data.deliveryLocation ? ` (${data.deliveryLocation})` : ""}</td><td style="padding:8px 0;text-align:right;color:#9a9a95;">${currencyKES(data.deliveryFee)}</td></tr>
       <tr><td style="padding:12px 0 0;font-weight:800;">Total</td><td style="padding:12px 0 0;text-align:right;font-weight:800;">${currencyKES(data.total)}</td></tr>
     </table>`,
  );
  return sendEmail({ to, subject: `Order #${data.orderId} received — ${BRAND}`, html });
}

export async function sendOrderPaidEmail(to: string, data: OrderEmailData): Promise<boolean> {
  const html = shell(
    `Payment confirmed for order #${data.orderId}`,
    `<p style="margin:0 0 16px;color:#555;">Hi ${data.customerName}, we've received your payment of <strong>${currencyKES(data.total)}</strong>. Your order is now being prepared for delivery${data.deliveryLocation ? ` to ${data.deliveryLocation}` : ""}.</p>
     <table style="width:100%;border-collapse:collapse;font-size:14px;">${orderRows(data.items)}
       <tr><td style="padding:12px 0 0;font-weight:800;">Total paid</td><td style="padding:12px 0 0;text-align:right;font-weight:800;">${currencyKES(data.total)}</td></tr>
     </table>`,
  );
  return sendEmail({ to, subject: `Payment confirmed — order #${data.orderId}`, html });
}
