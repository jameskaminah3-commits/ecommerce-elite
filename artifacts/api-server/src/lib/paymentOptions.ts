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
//  - Manual M-Pesa: needs at least one of Send-Money number / Till / Paybill set in
//    admin. Customers pay by hand, enter the M-Pesa code, and the team confirms it.
export interface PaymentOptions {
  onlineAvailable: boolean;
  manualMpesaAvailable: boolean;
  settings: SiteSettings | null;
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
  const gateway = isPaystackConfigured();
  return {
    onlineAvailable: gateway && (settings?.onlinePaymentsEnabled ?? true),
    manualMpesaAvailable: Boolean(settings && (settings.mpesaSendPhone || settings.mpesaTill || settings.mpesaPaybill)),
    settings,
  };
}

export async function getPaymentOptions(): Promise<PaymentOptions> {
  return paymentOptionsFrom(await getSettingsRow());
}

export const ONLINE_METHODS = new Set(["mpesa", "airtel", "card", "paystack", "pesapal"]);
