import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories } from '@workspace/api-client-react';
import { ProductCard } from '@/components/products/ProductCard';
import { Link } from 'wouter';
import { ArrowRight, ChevronRight, Truck, ShieldCheck, Clock, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { data: featuredProducts, isLoading: isFeaturedLoading } = useListProducts({ 
    query: { queryKey: ['products', 'featured'] },
  }); // Note: in real API we might pass featured: true. For now we just get list.
  
  const { data: categories, isLoading: isCategoriesLoading } = useListCategories();

  // Pick top 4 products for featured section
  const showcaseProducts = featuredProducts?.items?.slice(0, 4) || [];
  const newArrivals = featuredProducts?.items?.slice(4, 12) || [];

  return (
    <StorefrontLayout>
      {/* Hero Section */}
      <section className="relative bg-secondary text-secondary-foreground overflow-hidden">
        {/* Abstract background pattern */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
             <defs>
               <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                 <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
               </pattern>
             </defs>
             <rect width="100%" height="100%" fill="url(#grid)" />
           </svg>
        </div>
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-2xl">
            <span className="inline-block py-1 px-3 rounded-full bg-primary/20 text-primary font-bold text-xs tracking-wider mb-6 border border-primary/30">
              KENYA'S PREMIER WHOLESALER
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
              Equip Your <span className="text-primary">Business</span> & Home.
            </h1>
            <p className="text-lg md:text-xl text-secondary-foreground/80 mb-10 leading-relaxed max-w-xl">
              From commercial electronics to premium home living. Source thousands of products at wholesale prices, directly from our Nairobi warehouse.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="h-14 px-8 text-base font-bold shadow-xl shadow-primary/20">
                <Link href="/products">Shop Catalogue</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base bg-transparent border-secondary-foreground/20 hover:bg-secondary-foreground/10 text-secondary-foreground">
                <Link href="/account">Create Account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-border">
            <div className="flex flex-col items-center px-4">
              <Truck className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-sm">Nationwide Delivery</h3>
              <p className="text-xs text-muted-foreground mt-1">Fast shipping across Kenya</p>
            </div>
            <div className="flex flex-col items-center px-4">
              <ShieldCheck className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-sm">Quality Guaranteed</h3>
              <p className="text-xs text-muted-foreground mt-1">100% authentic products</p>
            </div>
            <div className="flex flex-col items-center px-4">
              <Clock className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-sm">Wholesale Pricing</h3>
              <p className="text-xs text-muted-foreground mt-1">Buy more, save more</p>
            </div>
            <div className="flex flex-col items-center px-4">
              <Headphones className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-bold text-sm">24/7 Support</h3>
              <p className="text-xs text-muted-foreground mt-1">Dedicated customer service</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Shop by Category</h2>
              <p className="text-muted-foreground mt-2">Find exactly what you need for your business or home.</p>
            </div>
          </div>
          
          {isCategoriesLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {categories?.slice(0, 4).map(category => (
                <Link key={category.id} href={`/products?category=${category.slug}`} className="group block relative overflow-hidden rounded-2xl aspect-square bg-muted">
                  {category.imageUrl ? (
                     <img src={category.imageUrl} alt={category.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full bg-secondary/10 flex items-center justify-center">
                      <span className="font-bold text-secondary/30 text-2xl uppercase">{category.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
                    <h3 className="text-white font-bold text-xl md:text-2xl mb-1">{category.name}</h3>
                    <span className="text-white/80 text-sm font-medium flex items-center gap-1 group-hover:text-primary transition-colors">
                      Shop Now <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 md:py-24 bg-muted/30 border-y">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Featured Offers</h2>
              <p className="text-muted-foreground mt-2">Premium stock selected by our team.</p>
            </div>
            <Button asChild variant="ghost" className="hidden md:flex text-primary hover:text-primary/80">
              <Link href="/products">View All <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
          
          {isFeaturedLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-80 bg-card border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {showcaseProducts.map((product, i) => (
                <div key={product.id} className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-8 text-center md:hidden">
            <Button asChild variant="outline" className="w-full">
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary"></div>
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1586528116311-ad8ed7c8d763?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-multiply opacity-20"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold text-primary-foreground mb-6">Bulk Orders? Open a Business Account.</h2>
          <p className="text-primary-foreground/90 text-lg md:text-xl max-w-2xl mx-auto mb-10">
            Get exclusive access to tier pricing, dedicated account managers, and flexible credit terms for your retail business in Kenya.
          </p>
          <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-base font-bold">
            <Link href="/account">Apply for Wholesale</Link>
          </Button>
        </div>
      </section>
      
      {/* New Arrivals */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight">New Arrivals</h2>
            <div className="w-16 h-1 bg-primary mx-auto mt-6 rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
             {newArrivals.map((product) => (
                <ProductCard key={product.id} product={product} />
             ))}
          </div>
        </div>
      </section>
    </StorefrontLayout>
  );
}
