import React from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';

interface PromoTileProps {
  variant: 'local-brands' | 'wholesale' | 'new-arrivals' | 'clearance';
  className?: string;
}

const PROMOS = {
  'local-brands': {
    badge: 'LOCALLY SOURCED',
    headline: 'Support Kenyan Brands',
    sub: 'Up to 30% off premium locally-made products',
    cta: 'Explore Collection',
    href: '/products',
    bg: 'from-[hsl(160_50%_12%)] to-[hsl(160_50%_20%)]',
    accent: 'text-primary',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=600&auto=format&fit=crop',
  },
  'wholesale': {
    badge: 'BULK DEAL',
    headline: 'Buy 10+, Save 15%',
    sub: 'On all electronics & home products. No code needed.',
    cta: 'Shop in Bulk',
    href: '/products?category=electronics',
    bg: 'from-[hsl(14_85%_15%)] to-[hsl(14_85%_25%)]',
    accent: 'text-orange-400',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop',
  },
  'new-arrivals': {
    badge: 'JUST LANDED',
    headline: 'Fresh Stock This Week',
    sub: 'New items added daily from our Nairobi warehouse.',
    cta: 'See What\'s New',
    href: '/products?sort=newest',
    bg: 'from-[hsl(220_60%_12%)] to-[hsl(220_60%_22%)]',
    accent: 'text-blue-400',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop',
  },
  'clearance': {
    badge: 'CLEARANCE SALE',
    headline: 'Final Stock, Big Savings',
    sub: 'Up to 50% off. Limited quantities. Act fast.',
    cta: 'Shop Clearance',
    href: '/products',
    bg: 'from-[hsl(0_60%_12%)] to-[hsl(0_60%_22%)]',
    accent: 'text-red-400',
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600&auto=format&fit=crop',
  },
};

export function PromoTile({ variant, className = '' }: PromoTileProps) {
  const p = PROMOS[variant];
  return (
    <Link
      href={p.href}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 min-h-[320px] cursor-pointer ${className}`}
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{ backgroundImage: `url('${p.image}')` }}
      />
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${p.bg} opacity-85`} />

      {/* Content */}
      <div className="relative z-10 p-6 text-white">
        <span className={`text-[9px] font-black tracking-[0.18em] uppercase ${p.accent} block mb-2`}>
          {p.badge}
        </span>
        <h3 className="text-lg font-extrabold tracking-tight leading-tight mb-1.5">
          {p.headline}
        </h3>
        <p className="text-xs text-white/70 leading-relaxed mb-4">{p.sub}</p>
        <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${p.accent} group-hover:gap-3 transition-all duration-200`}>
          {p.cta} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
