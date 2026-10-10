// Normalise a Kenyan phone number to the 2547XXXXXXXX / 2541XXXXXXXX MSISDN
// format that Safaricom Daraja expects. Accepts common local inputs like
// 07XX XXX XXX, 01XX XXX XXX, +2547…, and 2547….
export function normalizeKenyanMsisdn(input: string): string | null {
  const digits = (input || "").replace(/[^\d]/g, "");
  if (!digits) return null;

  // 07XXXXXXXX or 01XXXXXXXX (10 digits, leading 0)
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  // 7XXXXXXXX or 1XXXXXXXX (9 digits, no leading 0)
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  // 2547XXXXXXXX or 2541XXXXXXXX (12 digits)
  if (/^254[17]\d{8}$/.test(digits)) return digits;

  return null;
}

export interface ContactPhone {
  /** How Kenyans write it: 0719 627 868 */
  display: string;
  /** For tel: links and schema.org: +254719627868 */
  e164: string;
  /** For wa.me links: 254719627868 */
  msisdn: string;
}

// The admin may type several numbers in one box ("+254 719627868/+254740478464",
// "0719 627 868, 0740 478 464"). Split them and format each one consistently.
export function parseContactPhones(raw: string | null | undefined): ContactPhone[] {
  const out: ContactPhone[] = [];
  for (const part of (raw ?? "").split(/[\/,;|]|\s+or\s+|\s+and\s+/i)) {
    const msisdn = normalizeKenyanMsisdn(part);
    if (!msisdn) {
      const other = part.trim();
      // Keep a non-Kenyan number as typed rather than dropping it.
      if (other.replace(/\D/g, "").length >= 7) out.push({ display: other, e164: `+${other.replace(/\D/g, "")}`, msisdn: other.replace(/\D/g, "") });
      continue;
    }
    if (out.some((p) => p.msisdn === msisdn)) continue;
    const local = `0${msisdn.slice(3)}`;
    out.push({ display: `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`, e164: `+${msisdn}`, msisdn });
  }
  return out;
}
