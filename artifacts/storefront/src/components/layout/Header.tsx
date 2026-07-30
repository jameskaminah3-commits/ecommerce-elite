import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useListProducts } from '@workspace/api-client-react';
import { ShoppingBag, Search, Menu, User, LogOut, ChevronDown, X, TrendingUp, Tag, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';

// ── Mega-menu data ──────────────────────────────────────────────────────────
const MEGA_MENU: Record<string, {
  slug: string;
  featuredImage: string;
  featuredLabel: string;
  featuredSub: string;
  columns: { heading: string; links: { name: string; image: string; href: string }[] }[];
}> = {
  Electronics: {
    slug: 'electronics',
    featuredImage: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600&auto=format&fit=crop',
    featuredLabel: 'Smart TVs on Sale',
    featuredSub: 'Up to 20% off 4K displays',
    columns: [
      {
        heading: 'Devices',
        links: [
          { name: 'Smart TVs', image: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
          { name: 'Laptops & Tablets', image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
          { name: 'Smartphones', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
        ],
      },
      {
        heading: 'Audio & Wearables',
        links: [
          { name: 'Headphones', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
          { name: 'Smart Watches', image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
          { name: 'Accessories', image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=56&auto=format&fit=crop', href: '/products?category=electronics' },
        ],
      },
    ],
  },
  'Home & Living': {
    slug: 'home-living',
    featuredImage: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop',
    featuredLabel: 'Kitchen Essentials',
    featuredSub: 'Professional-grade cookware',
    columns: [
      {
        heading: 'Cookware',
        links: [
          { name: 'Cookware Sets', image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
          { name: 'Frying Pans', image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
          { name: 'Small Appliances', image: 'https://images.unsplash.com/photo-1559825481-12a05cc00344?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
        ],
      },
      {
        heading: 'Furniture & Comfort',
        links: [
          { name: 'Office Chairs', image: 'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
          { name: 'Storage Solutions', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
          { name: 'Bedding & Linen', image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=56&auto=format&fit=crop', href: '/products?category=home-living' },
        ],
      },
    ],
  },
  Decor: {
    slug: 'decor',
    featuredImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop',
    featuredLabel: 'Artisan Ceramics',
    featuredSub: 'Handcrafted in Kenya',
    columns: [
      {
        heading: 'Decor',
        links: [
          { name: 'Vases & Ceramics', image: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=56&auto=format&fit=crop', href: '/products?category=decor' },
          { name: 'Wall Art', image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=56&auto=format&fit=crop', href: '/products?category=decor' },
          { name: 'Lighting', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=56&auto=format&fit=crop', href: '/products?category=decor' },
        ],
      },
    ],
  },
  Fashion: {
    slug: 'fashion',
    featuredImage: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&auto=format&fit=crop',
    featuredLabel: 'Smart Business Wear',
    featuredSub: 'Look sharp, buy wholesale',
    columns: [
      {
        heading: "Men's",
        links: [
          { name: 'Blazers & Suits', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4c15?w=56&auto=format&fit=crop', href: '/products?category=fashion' },
          { name: 'Shirts & Tops', image: 'https://images.unsplash.com/photo-1602810316693-3667c854239a?w=56&auto=format&fit=crop', href: '/products?category=fashion' },
        ],
      },
      {
        heading: "Women's",
        links: [
          { name: 'Dresses', image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=56&auto=format&fit=crop', href: '/products?category=fashion' },
          { name: 'Accessories', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=56&auto=format&fit=crop', href: '/products?category=fashion' },
        ],
      },
    ],
  },
  Beauty: {
    slug: 'beauty',
    featuredImage: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop',
    featuredLabel: 'Bestselling Serums',
    featuredSub: 'Vitamin C, Retinol & more',
    columns: [
      {
        heading: 'Skincare',
        links: [
          { name: 'Face Serums', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=56&auto=format&fit=crop', href: '/products?category=beauty' },
          { name: 'Moisturisers', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=56&auto=format&fit=crop', href: '/products?category=beauty' },
          { name: 'Haircare', image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=56&auto=format&fit=crop', href: '/products?category=beauty' },
        ],
      },
    ],
  },
  'Gym & Fitness': {
    slug: 'gym-fitness',
    featuredImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop',
    featuredLabel: 'Home Gym Setup',
    featuredSub: 'Everything you need, delivered',
    columns: [
      {
        heading: 'Equipment',
        links: [
          { name: 'Dumbbells & Weights', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=56&auto=format&fit=crop', href: '/products?category=gym-fitness' },
          { name: 'Yoga & Pilates', image: 'https://images.unsplash.com/photo-1601925228008-22d2a5090f0c?w=56&auto=format&fit=crop', href: '/products?category=gym-fitness' },
          { name: 'Cardio Equipment', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=56&auto=format&fit=crop', href: '/products?category=gym-fitness' },
        ],
      },
    ],
  },
};

const TRENDING_SEARCHES = ['Office chairs', 'Vitamin C serum', '4K Smart TV', 'Yoga mats', 'Cookware sets'];
const SUGGESTED_COLLECTIONS = ['New Arrivals', 'Best Sellers', 'Wholesale Deals', 'Home Essentials'];

export function Header() {
  const { user, logout } = useAuth();
  const { cart, setCartDrawerOpen } = useCart();
  const [location] = useLocation();

  const [activeMega, setActiveMega] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: searchResults } = useListProducts({
    query: {
      queryKey: ['header-search', searchQuery],
      enabled: searchQuery.length >= 2,
    },
  });

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMegaEnter = useCallback((name: string) => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    setActiveMega(name);
  }, []);

  const handleMegaLeave = useCallback(() => {
    megaTimer.current = setTimeout(() => setActiveMega(null), 120);
  }, []);

  const navCategories = Object.keys(MEGA_MENU);

  return (
    <>
      {/* Utility bar */}
      <div className="w-full bg-secondary text-secondary-foreground/80 text-[11px] font-medium text-center py-2 tracking-wide border-b border-white/5 hidden sm:block">
        Free delivery across Kenya on orders over{' '}
        <span className="text-primary font-bold">KES 5,000</span>
        &nbsp;·&nbsp; Wholesale pricing. No middlemen. &nbsp;·&nbsp;
        <Link href="/account" className="underline underline-offset-2 hover:text-secondary-foreground transition-colors">
          Open a Business Account
        </Link>
      </div>

      <header
        className="sticky top-0 z-40 w-full bg-background/98 backdrop-blur-sm border-b border-border/60"
        onMouseLeave={handleMegaLeave}
      >
        <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 bg-primary rounded flex items-center justify-center text-primary-foreground font-black text-lg tracking-tighter leading-none">
                H
              </div>
              <span className="font-black text-lg tracking-tight hidden sm:inline-block">Happyfine</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 ml-4 text-sm font-medium">
              {navCategories.map((cat) => (
                <button
                  key={cat}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                    activeMega === cat
                      ? 'text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  onMouseEnter={() => handleMegaEnter(cat)}
                >
                  {cat}
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${activeMega === cat ? 'rotate-180' : ''}`}
                  />
                </button>
              ))}
              <Link
                href="/products"
                className={`px-3 py-1.5 rounded-md transition-colors text-sm font-medium ${
                  location === '/products' ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                All Products
              </Link>
            </nav>
          </div>

          {/* Search + actions */}
          <div className="flex items-center gap-2">
            {/* Predictive search */}
            <div className="hidden sm:block relative" ref={searchRef}>
              <div className={`flex items-center border rounded-md transition-all duration-200 ${
                searchFocused ? 'w-80 border-primary/50 bg-background shadow-sm' : 'w-56 border-border/50 bg-muted/40'
              }`}>
                <Search className="w-3.5 h-3.5 ml-3 shrink-0 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  className="h-8 flex-1 bg-transparent pl-2.5 pr-3 text-sm focus-visible:outline-none placeholder:text-muted-foreground/60"
                />
                {searchQuery && (
                  <button className="mr-2" onClick={() => setSearchQuery('')}>
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Predictive dropdown */}
              {searchFocused && (
                <div className="absolute top-full mt-2 right-0 w-[620px] bg-background border rounded-xl shadow-2xl overflow-hidden z-50 flex">
                  {/* Left pane */}
                  <div className="w-52 shrink-0 border-r bg-muted/30 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
                      <TrendingUp className="w-3 h-3" /> Trending
                    </p>
                    <ul className="space-y-1">
                      {TRENDING_SEARCHES.map((s) => (
                        <li key={s}>
                          <button
                            className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-background hover:text-primary transition-colors"
                            onClick={() => { setSearchQuery(s); }}
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
                        <Tag className="w-3 h-3" /> Collections
                      </p>
                      <ul className="space-y-1">
                        {SUGGESTED_COLLECTIONS.map((c) => (
                          <li key={c}>
                            <Link
                              href="/products"
                              className="block px-2 py-1.5 text-sm rounded-md hover:bg-background hover:text-primary transition-colors"
                              onClick={() => setSearchFocused(false)}
                            >
                              {c}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Right pane - live results */}
                  <div className="flex-1 p-4">
                    {searchQuery.length < 2 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Start typing to search products</p>
                      </div>
                    ) : !searchResults?.items?.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">No results for "{searchQuery}"</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
                          Products
                        </p>
                        <ul className="space-y-2">
                          {searchResults.items.slice(0, 4).map((product) => (
                            <li key={product.id}>
                              <Link
                                href={`/products/${product.id}`}
                                onClick={() => setSearchFocused(false)}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                              >
                                <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
                                  {product.imageUrl && (
                                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                                    {product.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{product.categoryName}</p>
                                </div>
                                <span className="text-sm font-bold text-primary shrink-0">
                                  {formatCurrency(product.basePrice)}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        {(searchResults.total ?? 0) > 4 && (
                          <Link
                            href={`/products?search=${searchQuery}`}
                            onClick={() => setSearchFocused(false)}
                            className="flex items-center gap-1 text-xs text-primary font-semibold mt-3 hover:gap-2 transition-all"
                          >
                            See all {searchResults.total} results <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile search */}
            <Button variant="ghost" size="icon" className="sm:hidden">
              <Search className="h-5 w-5" />
            </Button>

            {/* User menu */}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
                      {user.name.charAt(0)}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="w-full cursor-pointer">My Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="w-full cursor-pointer">Order History</Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="w-full cursor-pointer text-primary font-semibold">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" size="sm" className="hidden sm:flex text-sm">
                <Link href="/account">
                  <User className="w-4 h-4 mr-1.5" />
                  Sign In
                </Link>
              </Button>
            )}

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setCartDrawerOpen(true)}
              data-testid="button-open-cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cart?.itemCount ? (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center border-2 border-background leading-none px-1">
                  {cart.itemCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>

        {/* Mega-menu panel */}
        {activeMega && MEGA_MENU[activeMega] && (
          <div
            className="absolute left-0 right-0 top-full bg-background border-b border-border shadow-2xl z-50"
            onMouseEnter={() => { if (megaTimer.current) clearTimeout(megaTimer.current); }}
            onMouseLeave={handleMegaLeave}
          >
            <div className="container mx-auto px-4 py-6 flex gap-8">
              {/* Featured image */}
              <Link
                href={`/products?category=${MEGA_MENU[activeMega].slug}`}
                className="group relative w-60 shrink-0 rounded-xl overflow-hidden bg-muted"
                onClick={() => setActiveMega(null)}
              >
                <img
                  src={MEGA_MENU[activeMega].featuredImage}
                  alt={activeMega}
                  className="w-full h-44 object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex flex-col justify-end p-4">
                  <p className="text-white font-bold text-sm leading-tight">{MEGA_MENU[activeMega].featuredLabel}</p>
                  <p className="text-white/70 text-xs mt-0.5">{MEGA_MENU[activeMega].featuredSub}</p>
                  <span className="text-primary text-xs font-bold flex items-center gap-1 mt-2 group-hover:gap-2 transition-all">
                    Shop Now <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </Link>

              {/* Sub-category columns */}
              <div className="flex gap-12 flex-1">
                {MEGA_MENU[activeMega].columns.map((col) => (
                  <div key={col.heading}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-4">
                      {col.heading}
                    </p>
                    <ul className="space-y-3">
                      {col.links.map((link) => (
                        <li key={link.name}>
                          <Link
                            href={link.href}
                            onClick={() => setActiveMega(null)}
                            className="flex items-center gap-3 group/link"
                          >
                            <div className="w-9 h-9 rounded-md bg-muted overflow-hidden shrink-0 border border-border/50">
                              <img
                                src={link.image}
                                alt={link.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/link:scale-110"
                              />
                            </div>
                            <span className="text-sm font-medium text-muted-foreground group-hover/link:text-foreground group-hover/link:text-primary transition-colors">
                              {link.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* View all */}
              <div className="shrink-0 self-start">
                <Link
                  href={`/products?category=${MEGA_MENU[activeMega].slug}`}
                  onClick={() => setActiveMega(null)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-primary border border-primary/30 rounded-lg px-4 py-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  All {activeMega} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b">
              <span className="font-black text-lg">Happyfine</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              {navCategories.map((cat) => (
                <Link
                  key={cat}
                  href={`/products?category=${MEGA_MENU[cat].slug}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 hover:text-primary transition-colors"
                >
                  {cat}
                  <ArrowRight className="w-4 h-4 opacity-40" />
                </Link>
              ))}
              <div className="border-t mt-4 pt-4">
                <Link href="/products" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors">
                  All Products
                </Link>
                {!user && (
                  <Link href="/account" onClick={() => setMobileOpen(false)} className="block px-4 py-3 text-sm font-medium text-primary hover:bg-muted/50 transition-colors">
                    Sign In / Register
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
