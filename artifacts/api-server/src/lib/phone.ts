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
