import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export type PromotionTheme = 'brand' | 'festive' | 'gold' | 'night';

export interface LivePromotion {
  id: number;
  title: string;
  subtitle: string;
  announcement: string;
  ctaLabel: string;
  ctaHref: string;
  theme: PromotionTheme;
  showCountdown: boolean;
  discountPercent: number;
  /** e.g. "25% off Audio & Kitchen" — empty for a banner-only promotion. */
  discountLabel: string;
  endsAt: string;
}

interface ActiveResponse {
  serverNow: string;
  items: LivePromotion[];
}

async function fetchActive(): Promise<ActiveResponse> {
  const res = await fetch(`${API_BASE}/api/promotions/active`);
  if (!res.ok) return { serverNow: new Date().toISOString(), items: [] };
  return res.json();
}

// The promotion that is live right now, if any. Campaigns are scheduled in admin
// and switch on/off by themselves, so this re-checks regularly. `offset` is the
// difference between the server's clock and this device's, so a countdown shows
// the real time left even on a phone whose clock is wrong.
export function useLivePromotion(): { promo: LivePromotion | null; offset: number } {
  const { data } = useQuery({
    queryKey: ['promotions-active'],
    queryFn: fetchActive,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const offset = useMemo(() => (data ? Date.parse(data.serverNow) - Date.now() : 0), [data]);

  // Re-evaluate periodically so an ended promotion disappears without a reload.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const promo = data?.items.find((p) => Date.parse(p.endsAt) > Date.now() + offset) ?? null;
  return { promo, offset };
}
