import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { ProductCard } from '@/components/products/ProductCard';
import { SkeletonCard, SkeletonCategoryCard } from '@/components/products/SkeletonCard';
import { PromoTile } from '@/components/products/PromoTile';
import { Link } from 'wouter';
import { ArrowRight, ChevronRight, Truck, ShieldCheck, Clock, Headphones, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Injects a promo tile at every Nth slot in the product grid
function interleavedGrid(products: any[], promos: React.ReactNode[], everyN = 4) {
  const result: { type: 'product' | 'promo'; content: any; key: string }[] = [];
  let promoIdx = 0;
  products.forEach((p, i) => {
    result.push({ type: 'product', content: p, key: `p-${p.id}` });
    if ((i + 1) % everyN === 0 && promoIdx < promos.length) {
      result.push({ type: 'promo', content: promos[promoIdx], key: `promo-${promoIdx}` });
      promoIdx++;
    }
  });
  return result;
}

export default function Home() {
  const { data: productsData, isLoading: isFeaturedLoading } = useListProducts({
    query: { queryKey: ['products', 'home'] },
  } as any);
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();

  const allProducts = productsData?.items || [];
  const featuredProducts = allProducts.slice(0, 8);
  const newArrivals = allProducts.slice(4, 12);

  const promoNodes = [
    <PromoTile key="local" variant="local-brands" className="h-full" />,
    <PromoTile key="wholesale" variant="wholesale" className="h-full" />,
  ];

  const interleavedFeatured = interleavedGrid(featuredProducts, promoNodes, 4);

  return (
    <StorefrontLayout>

      {/* ── HERO — Asymmetric 2/3 + 1/3 editorial collage ─────────────── */}
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

      {/* ── Category grid — mobile: touch carousel; desktop: 6-col grid ── */}
      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary mb-2">Browse</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Shop by Category</h2>
            </div>
            <Link href="/products" className="hidden md:flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {isCategoriesLoading ? (
            /* Skeleton — same grid & aspect ratio as real cards (CLS = 0) */
            <div className="hidden md:grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCategoryCard key={i} />
              ))}
            </div>
          ) : (
            <>
              {/* Desktop grid */}
              <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                {categories?.map((cat, i) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="group relative overflow-hidden rounded-xl aspect-[3/4] bg-muted block"
                    style={{ willChange: 'transform' }}
                  >
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        style={{ willChange: 'transform' }}
                      />
                    ) : (
                      <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
                        <span className="font-black text-secondary/20 text-xl uppercase">{cat.name[0]}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-white font-bold text-sm leading-tight">{cat.name}</h3>
                      <span className="text-white/60 text-[10px] font-medium flex items-center gap-0.5 mt-1 group-hover:text-primary transition-colors">
                        Shop <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Mobile: touch-swipeable carousel with snap + inertia */}
              <div
                className="md:hidden flex gap-3 overflow-x-auto pb-3 -mx-4 px-4"
                style={{
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                }}
              >
                {categories?.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    className="group relative overflow-hidden rounded-xl bg-muted shrink-0"
                    style={{
                      width: '45vw',
                      aspectRatio: '3/4',
                      scrollSnapAlign: 'start',
                      willChange: 'transform',
                    }}
                  >
                    {cat.imageUrl && (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-white font-bold text-sm">{cat.name}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Story banner #1 — parallax ─────────────────────────────────── */}
      <div
        className="relative h-52 md:h-64 overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1607082349566-187342175e2f?w=1800&auto=format&fit=crop&q=70)',
          backgroundAttachment: 'fixed',
          backgroundPosition: 'center 30%',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-secondary/75" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-primary mb-3">Happyfine Promise</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-secondary-foreground tracking-tight">
            Wholesale Prices. Retail Convenience.
          </h2>
          <p className="text-secondary-foreground/60 text-sm mt-2 max-w-md">
            Everything your business needs, in one catalogue. No bulk minimums on most products.
          </p>
        </div>
      </div>

      {/* ── Featured products — polymorphic promo tiles ────────────────── */}
      <section className="py-14 md:py-20 bg-muted/20 border-y">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary mb-2">Handpicked</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Featured Offers</h2>
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
              {interleavedFeatured.map((slot, i) =>
                slot.type === 'product' ? (
                  <div
                    key={slot.key}
                    className="animate-in fade-in slide-in-from-bottom-6 duration-500 fill-mode-both"
                    style={{ animationDelay: `${(i % 5) * 60}ms`, willChange: 'transform' }}
                  >
                    <ProductCard product={slot.content} />
                  </div>
                ) : (
                  <div
                    key={slot.key}
                    className="animate-in fade-in duration-700 fill-mode-both"
                    style={{ animationDelay: `${(i % 5) * 60}ms` }}
                  >
                    {slot.content}
                  </div>
                ),
              )}
            </div>
          )}

          <div className="mt-6 text-center md:hidden">
            <Button asChild variant="outline" className="w-full">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Story banner #2 ────────────────────────────────────────────── */}
      <div
        className="relative h-64 md:h-80 overflow-hidden"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1586528116311-ad8ed7c8d763?w=1800&auto=format&fit=crop&q=70)',
          backgroundAttachment: 'fixed',
          backgroundPosition: 'center 60%',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-primary/85" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-primary-foreground/60 mb-4">For Businesses</span>
          <h2 className="text-2xl md:text-4xl font-extrabold text-primary-foreground tracking-tight mb-3">
            Bulk Orders? Open a Business Account.
          </h2>
          <p className="text-primary-foreground/75 text-sm md:text-base max-w-xl mx-auto mb-7">
            Exclusive tier pricing, dedicated account managers, and flexible credit terms for Kenyan retailers.
          </p>
          <Button asChild size="lg" variant="secondary" className="h-12 px-8 font-bold shadow-xl" style={{ willChange: 'transform' }}>
            <Link href="/account">Apply for Wholesale</Link>
          </Button>
        </div>
      </div>

      {/* ── New Arrivals ───────────────────────────────────────────────── */}
      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary mb-2">Fresh Stock</p>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">New Arrivals</h2>
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
              <PromoTile variant="clearance" />
            </div>
          )}
        </div>
      </section>

    </StorefrontLayout>
  );
}
