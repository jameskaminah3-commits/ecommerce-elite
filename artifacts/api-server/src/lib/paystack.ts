import crypto from "crypto";
import { logger } from "./logger";

// Paystack client (https://paystack.com). Uses fetch directly — no SDK.
//
// Required env:
//   PAYSTACK_SECRET_KEY  — secret key (sk_test_… / sk_live_…)
// Optional:
//   PAYSTACK_CURRENCY    — defaults to "KES"
//
// This server flow uses the redirect ("initialize") approach, which needs only
// the secret key. The public key (pk_…) is only needed for inline checkout.

const BASE = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return Boolean(process.env["PAYSTACK_SECRET_KEY"]);
}

function currency(): string {
  return process.env["PAYSTACK_CURRENCY"] ?? "KES";
}

function secretKey(): string {
  return process.env["PAYSTACK_SECRET_KEY"]!;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(opts: {
  email: string;
  amount: number; // whole KES
  reference: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      // Paystack expects the amount in the currency's subunit (cents).
      amount: Math.round(opts.amount * 100),
      currency: currency(),
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !data?.status) {
    logger.error({ status: res.status, data }, "Paystack initialize failed");
    throw new Error(String(data?.message ?? "Paystack initialize failed"));
  }
  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export interface VerifyResult {
  status: string; // "success", "failed", "abandoned", …
  amount: number; // whole KES
  reference: string;
  paidAt: string | null;
}

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  const res = await fetch(`${BASE}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
  });
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok || !data?.status) {
    logger.error({ status: res.status, data }, "Paystack verify failed");
    throw new Error(String(data?.message ?? "Paystack verify failed"));
  }
  return {
    status: data.data.status,
    amount: (data.data.amount ?? 0) / 100,
    reference: data.data.reference,
    paidAt: data.data.paid_at ?? null,
  };
}

// Verify the X-Paystack-Signature header on a webhook: HMAC-SHA512 of the raw
// request body keyed by the secret key.
export function verifyWebhookSignature(rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
