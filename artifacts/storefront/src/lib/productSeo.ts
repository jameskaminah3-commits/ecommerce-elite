import { formatCurrency, productPath } from '@/lib/utils';

// Helpers for the admin's "is this product ready to sell and to rank?" checks.
// The wording mirrors what the server renders for search engines (see api-server seo.ts).

export interface SeoProduct {
  id?: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  basePrice?: number;
  compareAtPrice?: number | null;
  categoryId?: number | null;
  imageUrl?: string | null;
  images?: string[];
  tags?: string[];
  status?: string;
  totalStock?: number;
  metaTitle?: string;
  metaDescription?: string;
}

export type Visibility =
  | { live: true; tone: 'ok' | 'warn'; label: string; hint?: string }
  | { live: false; tone: 'off' | 'warn'; label: string; hint: string; needsPrice?: boolean };

/** Can shoppers see and buy this product right now — and if not, why not? */
export function shopVisibility(p: SeoProduct): Visibility {
  if (p.status && p.status !== 'active') {
    return { live: false, tone: 'off', label: p.status === 'draft' ? 'Draft' : 'Inactive', hint: 'Set status to Active to show it in the shop.' };
  }
  if (!p.basePrice || p.basePrice <= 0) {
    return {
      live: false,
      tone: 'warn',
      label: 'Hidden · no price',
      hint: 'Customers can’t see this yet. Open Manage stock & variants and give each option a selling price.',
      needsPrice: true,
    };
  }
  if ((p.totalStock ?? 0) <= 0) {
    return { live: true, tone: 'warn', label: 'Live · out of stock', hint: 'Shown in the shop but can’t be bought until you add stock.' };
  }
  return { live: true, tone: 'ok', label: 'Live' };
}

export const BRAND = 'Happyfine Wholesalers';
export const TITLE_MAX = 65;
export const DESC_MAX = 160;

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  // Cut at a word boundary so snippets never end mid-word.
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-—]+$/, '')}…`;
}

// Same rule as the server: keep name + price within what Google displays (~65 chars).
export function autoSeoTitle(p: SeoProduct): string {
  const name = p.name || 'Product name';
  const price = p.basePrice && p.basePrice > 0 ? formatCurrency(p.basePrice) : 'KES —';
  const candidates = [
    `${name} Price in Kenya — ${price} | ${BRAND}`,
    `${name} Price in Kenya — ${price}`,
    `${name} — ${price} | ${BRAND}`,
    `${name} — ${price}`,
  ];
  const fit = candidates.find((c) => c.length <= 65);
  if (fit) return fit;
  const suffix = ` — ${price}`;
  return `${clip(name, Math.max(20, 65 - suffix.length))}${suffix}`;
}

export function autoSeoDescription(p: SeoProduct): string {
  const price = p.basePrice && p.basePrice > 0 ? p.basePrice : 0;
  const retail = p.compareAtPrice && p.compareAtPrice > price ? p.compareAtPrice : 0;
  const save = retail && price ? Math.round(((retail - price) / retail) * 100) : 0;
  const priceLine = price
    ? save > 0
      ? `Wholesale price ${formatCurrency(price)} (retail ${formatCurrency(retail)} — save ${save}%).`
      : `Wholesale price ${formatCurrency(price)}.`
    : '';
  const tail = ' No minimum order — pay with M-Pesa, delivered across Kenya.';
  const room = Math.max(0, 165 - priceLine.length - tail.length - 1);
  const snippet = room >= 40 && p.description ? clip(p.description, room) : '';
  return `${priceLine}${snippet ? ` ${snippet}` : ''}${tail}`.trim();
}

export function previewUrl(p: SeoProduct, origin: string): string {
  const path = p.id ? productPath({ id: p.id, slug: p.slug, name: p.name }) : `/products/…-${p.slug || 'product'}`;
  return `${origin.replace(/^https?:\/\//, '')}${path}`;
}

export interface SeoCheck {
  ok: boolean;
  label: string;
  tip: string;
}

/** A plain-language checklist of what makes a product page rank and convert. */
export function seoChecklist(p: SeoProduct): SeoCheck[] {
  const nameLen = p.name.trim().length;
  const descLen = (p.description ?? '').trim().length;
  const photos = [p.imageUrl, ...(p.images ?? [])].filter(Boolean).length;
  return [
    {
      ok: nameLen >= 20 && nameLen <= 80,
      label: 'Descriptive name',
      tip: 'Say what it is the way people search: brand, type, size/model (20–80 characters).',
    },
    {
      ok: descLen >= 150,
      label: 'Description of 150+ characters',
      tip: 'Explain what it does, what’s included, sizes and materials. Unique words help it rank.',
    },
    { ok: !!p.imageUrl, label: 'Main photo', tip: 'Product listings without a photo rarely get clicks.' },
    { ok: photos >= 3, label: '3 or more photos', tip: 'Different angles and in-use shots — they also appear in Google Images.' },
    { ok: !!p.categoryId, label: 'In a category', tip: 'Puts the product on its category page and in the breadcrumb.' },
    { ok: (p.tags ?? []).length >= 2, label: 'At least 2 tags', tip: 'Tags power the shop filters and add related keywords.' },
    {
      ok: !!p.compareAtPrice && (p.basePrice ?? 0) > 0 && p.compareAtPrice > (p.basePrice ?? 0),
      label: 'Typical retail price',
      tip: 'Shows “You save KES X” in the shop and the struck-through price on Google.',
    },
    {
      ok: (p.basePrice ?? 0) > 0 && (p.totalStock ?? 0) > 0,
      label: 'Priced and in stock',
      tip: 'Google only shows “In stock” with a price when the product can be bought.',
    },
  ];
}

export function seoScore(p: SeoProduct): { passed: number; total: number } {
  const checks = seoChecklist(p);
  return { passed: checks.filter((c) => c.ok).length, total: checks.length };
}
