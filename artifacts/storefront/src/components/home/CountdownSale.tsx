import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

function parts(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// A live-ticking sale countdown band. `target` is an ISO date; the timer hides
// itself once the sale has passed.
export function CountdownSale({
  target,
  title = 'Seasonal Sale',
  subtitle = 'Save up to 40% across the catalogue',
  ctaLabel = 'Shop the sale',
  ctaHref = '/products',
}: {
  target: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const targetMs = new Date(target).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (Number.isNaN(targetMs) || targetMs - now <= 0) return null;
  const t = parts(targetMs - now);
  const units: [string, number][] = [
    ['Days', t.days],
    ['Hours', t.hours],
    ['Minutes', t.minutes],
    ['Seconds', t.seconds],
  ];

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-secondary text-secondary-foreground px-6 py-8 md:px-12 md:py-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="text-center lg:text-left">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {title}
            </h2>
            <p className="text-secondary-foreground/70 mt-1.5 text-sm md:text-base">{subtitle}</p>
          </div>

          <div className="flex items-center gap-3 md:gap-5">
            {units.map(([label, value]) => (
              <div key={label} className="text-center min-w-[3.25rem]">
                <div className="text-3xl md:text-4xl font-semibold tabular-nums leading-none">{pad(value)}</div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-secondary-foreground/60 mt-1.5">{label}</div>
              </div>
            ))}
          </div>

          <Link
            href={ctaHref}
            className="shrink-0 inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm px-6 h-12 rounded-full hover:brightness-110 transition-all"
          >
            {ctaLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
