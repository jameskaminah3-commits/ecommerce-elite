import React, { useState } from 'react';
import { Link } from 'wouter';
import { Plus, ArrowRight } from 'lucide-react';
import type { Product } from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';

export interface LookHotspot {
  xPct: number; // 0–100 position across the image
  yPct: number;
  product: Product;
}

// An editorial lifestyle image with tappable product hotspots. Clicking a
// hotspot reveals a mini product card that links through to the product. Works
// on touch (tap toggles) and desktop alike.
export function ShopTheLook({
  image,
  eyebrow = 'Editorial',
  title,
  hotspots,
}: {
  image: string;
  eyebrow?: string;
  title?: React.ReactNode;
  hotspots: LookHotspot[];
}) {
  const [active, setActive] = useState<number | null>(null);
  if (!hotspots || hotspots.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mb-10 md:mb-14">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2.5">{eyebrow}</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            {title ?? <>Shop the <span className="serif-accent">look</span></>}
          </h2>
        </div>

        <div className="relative rounded-3xl overflow-hidden ring-1 ring-border/50 bg-muted">
          <img src={image} alt="" className="w-full aspect-[16/10] md:aspect-[21/9] object-cover" />

          {hotspots.map((h, i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: `${h.xPct}%`, top: `${h.yPct}%`, transform: 'translate(-50%, -50%)' }}
            >
              {/* Hotspot dot */}
              <button
                onClick={() => setActive(active === i ? null : i)}
                aria-label={`View ${h.product.name}`}
                className="relative w-9 h-9 rounded-full bg-background/90 backdrop-blur-sm text-foreground shadow-lg flex items-center justify-center transition-transform hover:scale-110"
              >
                <span className="absolute inset-0 rounded-full bg-background/60 animate-ping" />
                <Plus className={`relative w-4 h-4 transition-transform duration-300 ${active === i ? 'rotate-45' : ''}`} />
              </button>

              {/* Product popover */}
              {active === i && (
                <div className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 mt-3 w-56 bg-background rounded-2xl shadow-2xl ring-1 ring-border/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <Link href={`/products/${h.product.id}`} className="flex gap-3 p-3 items-center group">
                    <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                      {h.product.imageUrl && (
                        <img src={h.product.imageUrl} alt={h.product.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground/80 truncate">{h.product.categoryName}</p>
                      <p className="text-sm font-medium leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                        {h.product.name}
                      </p>
                      <p className="text-sm font-semibold mt-0.5">{formatCurrency(h.product.basePrice)}</p>
                    </div>
                  </Link>
                  <Link
                    href={`/products/${h.product.id}`}
                    className="flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-secondary-foreground bg-secondary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    View product <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
