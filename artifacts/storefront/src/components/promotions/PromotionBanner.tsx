import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useLivePromotion, type PromotionTheme } from '@/hooks/usePromotion';

// Colour treatments an admin can pick for a campaign.
export const PROMOTION_THEMES: Record<PromotionTheme, { label: string; card: string; muted: string; cta: string; swatch: string }> = {
  brand: { label: 'Brand green', card: 'bg-secondary text-secondary-foreground', muted: 'text-secondary-foreground/70', cta: 'bg-primary text-primary-foreground', swatch: 'bg-secondary' },
  festive: { label: 'Festive red', card: 'bg-[#7a1020] text-white', muted: 'text-white/70', cta: 'bg-white text-[#7a1020]', swatch: 'bg-[#7a1020]' },
  gold: { label: 'Gold', card: 'bg-[#1c1608] text-amber-50', muted: 'text-amber-50/65', cta: 'bg-amber-400 text-black', swatch: 'bg-amber-400' },
  night: { label: 'Night', card: 'bg-neutral-950 text-white', muted: 'text-white/65', cta: 'bg-primary text-primary-foreground', swatch: 'bg-neutral-950' },
};

const pad = (n: number) => String(n).padStart(2, '0');

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

export interface BannerData {
  title: string;
  subtitle?: string;
  ctaLabel: string;
  ctaHref: string;
  theme: PromotionTheme;
  showCountdown: boolean;
  /** Plain-English discount line, e.g. "25% off Audio & Kitchen". */
  discountLabel?: string;
}

// The visual banner. Separate from the data-fetching wrapper so the admin can
// show a live preview of exactly what shoppers will see.
export function BannerCard({ data, msLeft, preview = false, compact = false }: { data: BannerData; msLeft: number; preview?: boolean; compact?: boolean }) {
  const t = PROMOTION_THEMES[data.theme] ?? PROMOTION_THEMES.brand;
  const left = parts(msLeft);
  const units: [string, number][] = [['Days', left.days], ['Hours', left.hours], ['Mins', left.minutes], ['Secs', left.seconds]];
  const cta = (
    <>
      {data.ctaLabel} <ArrowRight className="w-4 h-4" />
    </>
  );
  const ctaClass = `shrink-0 inline-flex items-center justify-center gap-2 ${t.cta} font-semibold text-sm px-6 h-12 rounded-full hover:brightness-110 transition-all w-full sm:w-auto`;

  return (
    // `compact` keeps the stacked layout at any width — used by the admin preview,
    // which sits in a narrow dialog even on a wide screen.
    <div className={`rounded-3xl ${t.card} flex flex-col items-center justify-between gap-6 ${compact ? 'px-5 py-6' : 'px-5 py-7 md:px-12 md:py-10 lg:flex-row lg:gap-8'}`}>
      <div className={compact ? 'text-center' : 'text-center lg:text-left'}>
        {data.discountLabel ? (
          <p className={`inline-flex items-center rounded-full px-3 py-1 mb-3 text-[11px] font-bold uppercase tracking-[0.12em] ${t.cta}`}>{data.discountLabel}</p>
        ) : (
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mb-2 ${t.muted}`}>Limited time</p>
        )}
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">{data.title}</h2>
        {data.subtitle && <p className={`${t.muted} mt-1.5 text-sm md:text-base`}>{data.subtitle}</p>}
      </div>

      {data.showCountdown && (
        <div className="flex items-center gap-3 md:gap-5" aria-label="Time left">
          {units.map(([label, value]) => (
            <div key={label} className="text-center min-w-[3rem]">
              <div className="text-3xl md:text-4xl font-semibold tabular-nums leading-none">{pad(value)}</div>
              <div className={`text-[10px] uppercase tracking-[0.14em] mt-1.5 ${t.muted}`}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <span className={ctaClass}>{cta}</span>
      ) : data.ctaHref.startsWith('/') ? (
        <Link href={data.ctaHref} className={ctaClass}>{cta}</Link>
      ) : (
        <a href={data.ctaHref} className={ctaClass}>{cta}</a>
      )}
    </div>
  );
}

// Homepage band for whichever promotion is live. Renders nothing when there isn't
// one, and removes itself at the exact deadline.
export function PromotionBanner() {
  const { promo, offset } = useLivePromotion();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!promo) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [promo?.id]);

  if (!promo) return null;
  const msLeft = Date.parse(promo.endsAt) - (now + offset);
  if (msLeft <= 0) return null;

  return (
    <section className="py-6 md:py-10">
      <div className="container mx-auto px-4">
        <BannerCard data={promo} msLeft={msLeft} />
      </div>
    </section>
  );
}
