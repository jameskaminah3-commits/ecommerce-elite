import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { ProductCard } from '@/components/products/ProductCard';
import { SkeletonCard } from '@/components/products/SkeletonCard';
import { PromoGrid, type HomepageBlock } from '@/components/home/PromoBlock';
import { PinnedSplit } from '@/components/home/PinnedSplit';
import { SplitHero } from '@/components/home/SplitHero';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, ChevronRight, Truck, ShieldCheck, Clock, Headphones, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
async function fetchHomepageBlocks(): Promise<HomepageBlock[]> {
  const res = await fetch(`${API_BASE}/api/homepage-blocks`);
  if (!res.ok) return [];
  return res.json();
}

export default function Home() {
  const { data: productsData, isLoading: isFeaturedLoading } = useListProducts(
    { featured: true, limit: 12 },
    { query: { queryKey: ['products', 'home'] } as any },
  );
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();
  const { data: homepageBlocks } = useQuery({ queryKey: ['homepage-blocks'], queryFn: fetchHomepageBlocks });
  const heroBlocks = (homepageBlocks ?? []).filter((b) => (b.placement ?? 'grid') === 'hero');
  const gridBlocks = (homepageBlocks ?? []).filter((b) => (b.placement ?? 'grid') === 'grid');
  const pinnedBlocks = (homepageBlocks ?? []).filter((b) => b.placement === 'pinned');
  const hasHero = heroBlocks.length > 0;
  const hasGrid = gridBlocks.length > 0;
  const hasPinned = pinnedBlocks.length > 0;
  const hasBlocks = hasHero || hasGrid || hasPinned;

  const allProducts = productsData?.items || [];
  const featuredProducts = allProducts.slice(0, 8);
  const newArrivals = allProducts.slice(4, 12);

  return (
    <StorefrontLayout>

      {/* ── Split-panel hero (admin 'hero' blocks) ─────────────────────── */}
      {hasHero && (
        <section className="w-full">
          <div className="container mx-auto px-4 pt-6 md:pt-10">
            <SplitHero blocks={heroBlocks} />
          </div>
        </section>
      )}

      {/* ── Dynamic homepage blocks (admin-managed 12-col grid) ────────── */}
      {hasGrid && (
        <section className="w-full">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <PromoGrid blocks={gridBlocks} />
          </div>
        </section>
      )}

      {/* ── Sticky pinned split (admin 'pinned' blocks) ─────────────────── */}
      {hasPinned && (
        <section className="w-full">
          <div className="container mx-auto px-4 py-6 md:py-8">
            <PinnedSplit blocks={pinnedBlocks} />
          </div>
        </section>
      )}

      {/* ── HERO — Asymmetric 2/3 + 1/3 editorial collage (fallback) ───── */}
      {!hasBlocks && (
      <section className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[540px]">
          {/* Left 2/3 — lifestyle image block */}
          <div className="lg:col-span-2 relative overflow-hidden bg-secondary min-h-[400px] lg:min-h-[540px]">
            <img
              src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1400&auto=format&fit=crop&q=80"
              alt="Happyfine Wholesalers"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ willChange: 'transform' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-secondary/92 via-secondary/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-secondary/50 via-transparent to-transparent" />
            <div className="relative z-10 h-full flex flex-col justify-end p-8 md:p-12 max-w-xl">
              <span className="inline-block py-1 px-3 rounded-full bg-primary/20 text-primary font-bold text-[10px] tracking-[0.14em] mb-5 border border-primary/30 self-start uppercase">
                Kenya's Premier Wholesaler
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-5 leading-[1.08] text-secondary-foreground">
                Equip Your<br />
                <span className="text-primary">Business</span> &amp; Home.
              </h1>
              <p className="text-secondary-foreground/75 text-base md:text-lg leading-relaxed mb-8 max-w-md">
                Thousands of products at wholesale prices, direct from our Nairobi warehouse.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="h-12 px-7 font-bold shadow-lg shadow-primary/25" style={{ willChange: 'transform' }}>
                  <Link href="/products">Shop Catalogue</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-7 font-bold bg-transparent border-secondary-foreground/25 hover:bg-secondary-foreground/10 text-secondary-foreground">
                  <Link href="/account">Create Account</Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Right 1/3 — editorial promo panels */}
          <div className="lg:col-span-1 flex flex-col border-l border-white/5">
            <div className="flex-1 relative overflow-hidden bg-primary/90 p-7 flex flex-col justify-between min-h-[220px] lg:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop"
                alt="Flash deal"
                className="absolute inset-0 w-full h-full object-cover opacity-20"
              />
              <div className="relative z-10">
                <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] uppercase text-primary-foreground/70 mb-3">
                  <Zap className="w-3 h-3" /> Flash Deal
                </span>
                <h3 className="text-primary-foreground text-xl font-extrabold tracking-tight leading-tight mb-2">
                  Wireless Headphones<br />from KES 6,500
                </h3>
                <p className="text-primary-foreground/70 text-xs leading-relaxed">
                  Premium audio. Wholesale pricing. Limited stock.
                </p>
              </div>
              <Link
                href="/products?category=electronics"
                className="relative z-10 inline-flex items-center gap-1.5 text-xs font-bold text-primary-foreground border border-primary-foreground/30 rounded-lg px-4 py-2 hover:bg-primary-foreground hover:text-primary transition-colors self-start mt-4"
              >
                Shop Now <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex-1 relative overflow-hidden bg-secondary border-t border-white/5 p-7 flex flex-col justify-between min-h-[220px] lg:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&auto=format&fit=crop"
                alt="Home & Living"
                className="absolute inset-0 w-full h-full object-cover opacity-15"
              />
              <div className="relative z-10">
                <span className="text-[9px] font-black tracking-[0.18em] uppercase text-secondary-foreground/60 block mb-3">Just Landed</span>
                <h3 className="text-secondary-foreground text-xl font-extrabold tracking-tight leading-tight mb-2">
                  Home &amp; Kitchen<br />New Arrivals
                </h3>
                <p className="text-secondary-foreground/60 text-xs leading-relaxed">Professional cookware and furniture at unbeatable rates.</p>
              </div>
              <Link
                href="/products?category=home-living"
                className="relative z-10 inline-flex items-center gap-1.5 text-xs font-bold text-secondary-foreground border border-secondary-foreground/20 rounded-lg px-4 py-2 hover:bg-secondary-foreground hover:text-secondary transition-colors self-start mt-4"
              >
                Explore <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ── Value props bar ────────────────────────────────────────────── */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border">
            {[
              { icon: Truck, label: 'Nationwide Delivery', sub: 'Free over KES 5,000' },
              { icon: ShieldCheck, label: 'Quality Guaranteed', sub: '100% authentic products' },
              { icon: Clock, label: 'Wholesale Pricing', sub: 'Buy more, save more' },
              { icon: Headphones, label: '24/7 Support', sub: 'Dedicated team in Nairobi' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-xs">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Shop by Category — airy circular medallions (Expanse-style) ── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Browse</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Shop by <span className="serif-accent">category</span>
            </h2>
          </div>

          {isCategoriesLoading ? (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-3">
                  <div className="w-full aspect-square rounded-full bg-muted animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-x-4 gap-y-9 md:gap-y-12">
              {categories?.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/products?category=${cat.slug}`}
                  className="group flex flex-col items-center gap-3.5 text-center"
                >
                  <div className="relative w-full aspect-square rounded-full bg-muted/60 overflow-hidden ring-1 ring-border/60 transition-all duration-500 group-hover:ring-primary/40 group-hover:shadow-lg group-hover:-translate-y-1">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="font-serif italic text-3xl text-secondary/30">{cat.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm md:text-base font-medium text-foreground/90 group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Featured products ──────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-muted/25 border-y border-border/60">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10 md:mb-14">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2.5">Handpicked</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Featured <span className="serif-accent">offers</span></h2>
            </div>
            <Button asChild variant="ghost" className="hidden md:flex text-sm text-primary hover:text-primary/80">
              <Link href="/products">View All <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
          </div>

          {isFeaturedLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 items-start">
              {featuredProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="animate-in fade-in slide-in-from-bottom-6 duration-500 fill-mode-both"
                  style={{ animationDelay: `${(i % 5) * 60}ms`, willChange: 'transform' }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 text-center md:hidden">
            <Button asChild variant="outline" className="w-full">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── New Arrivals ───────────────────────────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10 md:mb-14">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2.5">Fresh Stock</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">New <span className="serif-accent">arrivals</span></h2>
            </div>
            <Link href="/products" className="hidden md:flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isFeaturedLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {newArrivals.map((product, i) => (
                <div
                  key={product.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
                  style={{ animationDelay: `${(i % 4) * 60}ms`, willChange: 'transform' }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </StorefrontLayout>
  );
}
