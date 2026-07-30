import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories, ListProductsSort, Product } from '@workspace/api-client-react';
import { ProductCard } from '@/components/products/ProductCard';
import { SkeletonCard } from '@/components/products/SkeletonCard';
import { Search, Filter, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 12;

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    search: p.get('search') || '',
    category: p.get('category') || 'all',
    sort: (p.get('sort') as ListProductsSort) || 'newest',
  };
}

export default function ProductsPage() {
  const initial = readUrlParams();
  const [search, setSearchRaw] = useState(initial.search);
  const [searchInput, setSearchInput] = useState(initial.search);
  const [category, setCategory] = useState(initial.category);
  const [sort, setSort] = useState<ListProductsSort>(initial.sort);
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isResetting = useRef(false);

  const { data: categories } = useListCategories();

  const selectedCategoryId =
    category !== 'all' ? categories?.find((c) => c.slug === category)?.id : undefined;

  const { data: productsPage, isLoading, isFetching } = useListProducts(
    {
      search: search || undefined,
      category: selectedCategoryId,
      sort,
      page,
      limit: PAGE_SIZE,
    },
    {
      query: {
        queryKey: ['products', search, selectedCategoryId, sort, page],
        keepPreviousData: true,
      } as any,
    },
  );

  // Append or replace results
  useEffect(() => {
    if (!productsPage) return;
    if (page === 1 || isResetting.current) {
      isResetting.current = false;
      setAllProducts(productsPage.items);
    } else {
      setAllProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...productsPage.items.filter((p) => !ids.has(p.id))];
      });
    }
    setHasMore(page * PAGE_SIZE < (productsPage.total ?? 0));
  }, [productsPage]);

  // Reset on filter change
  const applyFilters = useCallback(
    (newSearch: string, newCategory: string, newSort: ListProductsSort) => {
      isResetting.current = true;
      setPage(1);
      setAllProducts([]);
      setHasMore(true);
      setSearchRaw(newSearch);
      setCategory(newCategory);
      setSort(newSort);
    },
    [],
  );

  // Debounced search input
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      applyFilters(val, category, sort);
    }, 350);
  };

  const handleCategory = (slug: string) => {
    applyFilters(search, slug, sort);
  };

  const handleSort = (val: ListProductsSort) => {
    applyFilters(search, category, val);
  };

  // Sync URL (no page reload)
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'all') params.set('category', category);
    if (sort !== 'newest') params.set('sort', sort);
    const url = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({ search, category, sort }, '', url);
  }, [search, category, sort]);

  // Restore scroll position when navigating back from product detail
  useEffect(() => {
    const saved = sessionStorage.getItem('productsScrollY');
    if (saved) {
      const y = parseInt(saved, 10);
      setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }), 80);
      sessionStorage.removeItem('productsScrollY');
    }
  }, []);

  // IntersectionObserver — load next page when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isFetching) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.1, rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetching]);

  // Save scroll position before navigating to a product
  const saveScroll = () => {
    sessionStorage.setItem('productsScrollY', String(window.scrollY));
  };

  const total = productsPage?.total ?? 0;
  const activeFiltersCount = (search ? 1 : 0) + (category !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0);

  return (
    <StorefrontLayout>
      {/* Page header */}
      <div className="bg-muted/30 border-b py-8">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">All Products</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {total > 0 ? `${total} products` : 'Browse our complete catalogue'}
            </p>
          </div>
          {/* Mobile filter toggle */}
          <Button
            variant="outline"
            size="sm"
            className="sm:hidden flex items-center gap-2 self-start"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">

        {/* ── Sidebar filters ───────────────────────────────────────────── */}
        <aside
          className={cn(
            'w-full md:w-60 shrink-0 md:block space-y-8',
            filtersOpen ? 'block' : 'hidden',
          )}
        >
          {/* Search */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">
              Search
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search products..."
                className="pl-9 h-9 text-sm"
              />
              {searchInput && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => { setSearchInput(''); applyFilters('', category, sort); }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Categories */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> Category
            </p>
            <ul className="space-y-0.5">
              {[{ id: 0, name: 'All Categories', slug: 'all' }, ...(categories || [])].map((cat) => (
                <li key={cat.slug}>
                  <button
                    onClick={() => handleCategory(cat.slug)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      category === cat.slug
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Sort (mobile) */}
          <div className="md:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3 h-3" /> Sort by
            </p>
            <Select value={sort} onValueChange={(v) => handleSort(v as ListProductsSort)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest Arrivals</SelectItem>
                <SelectItem value="price_asc">Price: Low to High</SelectItem>
                <SelectItem value="price_desc">Price: High to Low</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters */}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/8 text-xs"
              onClick={() => {
                setSearchInput('');
                applyFilters('', 'all', 'newest');
              }}
            >
              <X className="w-3.5 h-3.5 mr-1.5" /> Clear all filters
            </Button>
          )}
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Controls bar */}
          <div className="hidden md:flex items-center justify-between mb-6 pb-4 border-b">
            <p className="text-sm text-muted-foreground">
              {isLoading ? (
                <span className="inline-block w-20 h-4 bg-muted rounded animate-pulse" />
              ) : (
                <>
                  Showing <span className="font-bold text-foreground">{allProducts.length}</span>
                  {total > allProducts.length && (
                    <> of <span className="font-bold text-foreground">{total}</span></>
                  )}{' '}
                  products
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
              <Select value={sort} onValueChange={(v) => handleSort(v as ListProductsSort)}>
                <SelectTrigger className="w-[180px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest Arrivals</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {search && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20">
                  "{search}"
                  <button onClick={() => { setSearchInput(''); applyFilters('', category, sort); }}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </span>
              )}
              {category !== 'all' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20">
                  {categories?.find((c) => c.slug === category)?.name || category}
                  <button onClick={() => applyFilters(search, 'all', sort)}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Grid */}
          {isLoading && page === 1 ? (
            // Initial skeleton — 2-col mobile, 3-col md, 4-col lg (strict spec)
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : allProducts.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold">No products found</h3>
              <p className="text-muted-foreground mt-1 text-sm">Try adjusting your filters.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => { setSearchInput(''); applyFilters('', 'all', 'newest'); }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            // 2-col mobile → 3-col md → 4-col lg (spec: strict 4-5 col at 1200px+)
            <div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4"
              onClick={saveScroll}
            >
              {allProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="animate-in fade-in slide-in-from-bottom-4 duration-400 fill-mode-both"
                  style={{
                    animationDelay: `${(i % 8) * 40}ms`,
                    willChange: 'transform',
                  }}
                >
                  <ProductCard product={product} />
                </div>
              ))}

              {/* Inline skeleton row while loading next page */}
              {isFetching && page > 1 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonCard key={`skel-${i}`} />
                ))}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-16 flex items-center justify-center mt-4">
            {isFetching && page > 1 && (
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
            {!hasMore && allProducts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                All {total} products loaded
              </p>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
