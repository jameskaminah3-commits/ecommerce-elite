// Contact numbers as the admin typed them can hold several numbers in one box
// ("+254 719627868/+254740478464"). These helpers split and format them the way
// Kenyans write numbers (0719 627 868) and build working tel: and WhatsApp links.

export interface ContactPhone {
  display: string; // 0719 627 868
  tel: string; // +254719627868
  msisdn: string; // 254719627868 (wa.me)
}

function toMsisdn(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(d)) return `254${d.slice(1)}`;
  if (/^[17]\d{8}$/.test(d)) return `254${d}`;
  if (/^254[17]\d{8}$/.test(d)) return d;
  return null;
}

export function parsePhones(raw?: string | null): ContactPhone[] {
  const out: ContactPhone[] = [];
  for (const part of (raw ?? '').split(/[\/,;|]|\s+or\s+|\s+and\s+/i)) {
    const msisdn = toMsisdn(part);
    if (!msisdn) {
      const digits = part.replace(/\D/g, '');
      if (digits.length >= 7) out.push({ display: part.trim(), tel: `+${digits}`, msisdn: digits });
      continue;
    }
    if (out.some((p) => p.msisdn === msisdn)) continue;
    const local = `0${msisdn.slice(3)}`;
    out.push({ display: `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`, tel: `+${msisdn}`, msisdn });
  }
  return out;
}

interface ContactSettings {
  whatsappNumber?: string;
  liveChatUrl?: string;
  contactPhone?: string;
}

/** The shop's WhatsApp number: the dedicated setting, else the first contact phone. */
export function whatsappPhone(s?: ContactSettings | null): ContactPhone | null {
  return parsePhones(s?.whatsappNumber)[0] ?? parsePhones(s?.contactPhone)[0] ?? null;
}

/** A wa.me chat link, optionally with a ready-typed message. */
export function whatsappHref(s?: ContactSettings | null, message?: string): string | null {
  const phone = whatsappPhone(s);
  if (phone) return `https://wa.me/${phone.msisdn}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  const url = s?.liveChatUrl?.trim();
  if (url && /wa\.me|whatsapp/i.test(url)) return url;
  return null;
}
