import { whatsappHref } from '@/lib/contact';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface WaLine {
  name: string;
  option?: string | null;
  quantity: number;
  /** Line total in KES. */
  amount: number;
}

export interface WaOrder {
  lines: WaLine[];
  total: number;
  source: 'Product page' | 'Cart' | 'Checkout';
  customerName?: string;
  customerPhone?: string;
  deliveryTown?: string;
  address?: string;
  url?: string;
}

const kes = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`;

// The message a shopper sends — written so the team can reply "Yes, available"
// without asking anything back. WhatsApp shows *text* in bold.
export function whatsappOrderMessage(o: WaOrder): string {
  const lines = o.lines.map(
    (l, i) => `${o.lines.length > 1 ? `${i + 1}. ` : '• '}*${l.name}*${l.option ? ` — ${l.option}` : ''} × ${l.quantity} — ${kes(l.amount)}`,
  );
  const who = [o.customerName, o.customerPhone].filter(Boolean).join(' · ');
  return [
    'Hello Happyfine Wholesalers 👋',
    "I'd like to order:",
    '',
    ...lines,
    '',
    `*Total: ${kes(o.total)}* (plus delivery)`,
    o.deliveryTown ? `Deliver to: ${o.deliveryTown}${o.address ? ` — ${o.address}` : ''}` : '',
    who ? `Name: ${who}` : '',
    o.url ? `Link: ${o.url}` : '',
    '',
    'Is it available?',
  ]
    .filter((l, i, arr) => !(l === '' && arr[i - 1] === ''))
    .join('\n')
    .trim();
}

export function whatsappOrderHref(settings: any, o: WaOrder): string | null {
  return whatsappHref(settings, whatsappOrderMessage(o));
}

// Tell the shop team a WhatsApp order is on its way (emailed to them). Fire-and-forget:
// keepalive lets it finish even as the phone switches to the WhatsApp app.
export function logWhatsAppOrder(o: WaOrder): void {
  try {
    fetch(`${API_BASE}/api/inquiries/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        source: o.source,
        items: o.lines.map((l) => ({ name: l.name, option: l.option, quantity: l.quantity, amount: l.amount })),
        total: o.total,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        deliveryTown: o.deliveryTown,
        url: o.url,
      }),
    }).catch(() => {});
  } catch {
    /* never block the shopper */
  }
}
