import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function clampPercent(pct: number | null | undefined): number {
  if (!pct || Number.isNaN(pct)) return 0;
  return Math.min(Math.max(Math.round(pct), 0), 90);
}

/** Apply a promotional discount percentage to a raw price. */
export function applyDiscount(price: number, discountPercent: number | null | undefined): number {
  const pct = clampPercent(discountPercent);
  return pct > 0 ? Math.round(price * (1 - pct / 100) * 100) / 100 : price;
}

export interface PriceInfo {
  price: number; // what the shopper pays
  original: number | null; // struck-through reference price, when on sale
  discountPct: number;
  onSale: boolean;
}

/**
 * Resolve a product's display pricing. A promotional `discountPercent` takes
 * precedence; otherwise a manual `compareAtPrice` above `basePrice` is treated
 * as the reference price. `basePrice` may be swapped for a selected variant price.
 */
export function getPriceInfo(
  product: { basePrice: number; compareAtPrice?: number | null; discountPercent?: number | null },
  overridePrice?: number,
): PriceInfo {
  const list = overridePrice ?? product.basePrice;
  const promo = clampPercent(product.discountPercent);

  if (promo > 0) {
    return { price: applyDiscount(list, promo), original: list, discountPct: promo, onSale: true };
  }
  if (product.compareAtPrice && product.compareAtPrice > list) {
    const pct = Math.round(((product.compareAtPrice - list) / product.compareAtPrice) * 100);
    return { price: list, original: product.compareAtPrice, discountPct: pct, onSale: true };
  }
  return { price: list, original: null, discountPct: 0, onSale: false };
}

// URL-safe slug — mirrors the server's slugify so links match the canonical URL.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// Product page URL: /products/<id>-<keyword-slug>. The id keeps it stable; the slug
// puts the product's keywords in the address for Google and for shared links.
export function productPath(p: { id: number; slug?: string | null; name?: string | null }): string {
  const tail = slugify(p.slug || p.name || '');
  return tail ? `/products/${p.id}-${tail}` : `/products/${p.id}`;
}
