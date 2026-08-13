import { logger } from "./logger";

// Safaricom Daraja (M-Pesa) STK Push client. Uses fetch directly — no SDK.
//
// Required env:
//   MPESA_ENV              — "sandbox" (default) or "production"
//   MPESA_CONSUMER_KEY     — Daraja app consumer key
//   MPESA_CONSUMER_SECRET  — Daraja app consumer secret
//   MPESA_SHORTCODE        — the Paybill/Till (BusinessShortCode) used for STK push
//   MPESA_PASSKEY          — the Lipa na M-Pesa Online passkey
//   MPESA_CALLBACK_URL     — public https URL Daraja calls back (should include ?token=<MPESA_CALLBACK_TOKEN>)

function baseUrl(): string {
  return process.env["MPESA_ENV"] === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export function isMpesaConfigured(): boolean {
  return Boolean(
    process.env["MPESA_CONSUMER_KEY"] &&
      process.env["MPESA_CONSUMER_SECRET"] &&
      process.env["MPESA_SHORTCODE"] &&
      process.env["MPESA_PASSKEY"] &&
      process.env["MPESA_CALLBACK_URL"],
  );
}

async function getAccessToken(): Promise<string> {
  const key = process.env["MPESA_CONSUMER_KEY"]!;
  const secret = process.env["MPESA_CONSUMER_SECRET"]!;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Daraja OAuth failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Daraja OAuth returned no access_token");
  return data.access_token;
}

// Daraja timestamp format: YYYYMMDDHHmmss. The timestamp only needs to be
// internally consistent with the password we derive from it.
function darajaTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

export async function initiateStkPush(opts: {
  msisdn: string; // 2547XXXXXXXX
  amount: number; // whole KES
  accountReference: string;
  description: string;
}): Promise<StkPushResult> {
  const shortcode = process.env["MPESA_SHORTCODE"]!;
  const passkey = process.env["MPESA_PASSKEY"]!;
  const callbackUrl = process.env["MPESA_CALLBACK_URL"]!;
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const token = await getAccessToken();

  // STK push requires a whole-number amount, minimum 1.
  const amount = Math.max(1, Math.round(opts.amount));

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: opts.msisdn,
    PartyB: shortcode,
    PhoneNumber: opts.msisdn,
    CallBackURL: callbackUrl,
    AccountReference: opts.accountReference.slice(0, 12),
    TransactionDesc: opts.description.slice(0, 13),
  };

  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data["ResponseCode"] !== "0") {
    logger.error({ status: res.status, data }, "Daraja STK push rejected");
    throw new Error(
      String(data["errorMessage"] ?? data["ResponseDescription"] ?? "STK push failed"),
    );
  }

  return {
    merchantRequestId: String(data["MerchantRequestID"] ?? ""),
    checkoutRequestId: String(data["CheckoutRequestID"] ?? ""),
    customerMessage: String(data["CustomerMessage"] ?? "STK push sent."),
  };
}
