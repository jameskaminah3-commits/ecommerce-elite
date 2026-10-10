import { eq } from "drizzle-orm";
import { db, siteSettingsTable, type SiteSettings } from "@workspace/db";
import { isPaystackConfigured } from "./paystack";
import { logger } from "./logger";

// What can customers actually pay with right now? Drives the checkout options AND
// is re-checked by the API when an order is placed, so a stale page can never
// create an order with a method the shop can't take.
//
//  - Online (M-Pesa STK push, Airtel Money, card): needs the payment gateway
//    configured on the server AND not switched off in admin. If either is false
//    these options simply don't appear — no broken "payment failed" experience.
//  - Lipa na M-PESA (manual): the way a physical shop takes M-Pesa.
//      · "pay_now" — a Pochi la Biashara / Till / Paybill / Send-Money number is set:
//        the customer pays on their phone, enters the M-Pesa code, the team confirms.
//      · "confirm_call" — nothing set yet: the customer still places the order and the
//        team calls to confirm it and share how to pay. Offered whenever online
//        payment isn't available, so checkout never dead-ends.
export type ManualPaymentMode = "pay_now" | "confirm_call";

export interface PaymentOptions {
  onlineAvailable: boolean;
  manualMpesaAvailable: boolean;
  manualPaymentMode: ManualPaymentMode;
  settings: SiteSettings | null;
}

export function hasMpesaDetails(s: SiteSettings | null): boolean {
  return Boolean(s && (s.mpesaPochiPhone || s.mpesaSendPhone || s.mpesaTill || s.mpesaPaybill));
}

export async function getSettingsRow(): Promise<SiteSettings | null> {
  try {
    const [row] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
    return row ?? null;
  } catch (err) {
    logger.warn({ err: (err as Error)?.message }, "Could not read site settings");
    return null;
  }
}

export function paymentOptionsFrom(settings: SiteSettings | null): PaymentOptions {
  const onlineAvailable = isPaystackConfigured() && (settings?.onlinePaymentsEnabled ?? true);
  const details = hasMpesaDetails(settings);
  return {
    onlineAvailable,
    manualMpesaAvailable: details || !onlineAvailable,
    manualPaymentMode: details ? "pay_now" : "confirm_call",
    settings,
  };
}

export async function getPaymentOptions(): Promise<PaymentOptions> {
  return paymentOptionsFrom(await getSettingsRow());
}

export const ONLINE_METHODS = new Set(["mpesa", "airtel", "card", "paystack", "pesapal"]);
