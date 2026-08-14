import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearch, Link } from 'wouter';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories, ListProductsSort, Product } from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { ProductCard } from '@/components/products/ProductCard';
import { SkeletonCard } from '@/components/products/SkeletonCard';
import { Search, Filter, SlidersHorizontal, X, ChevronRight, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';

const PAGE_SIZE = 12;
const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface Facets {
  tags: { value: string; count: number }[];
  priceRange: { min: number; max: number };
}

async function fetchFacets(categoryId?: number): Promise<Facets> {
  const qs = categoryId ? `?category=${categoryId}` : '';
  const res = await fetch(`${API_BASE}/api/products/facets${qs}`, { credentials: 'include' });
  if (!res.ok) return { tags: [], priceRange: { min: 0, max: 0 } };
  return res.json();
}

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    search: p.get('search') || '',
    category: p.get('category') || 'all',
    sort: (p.get('sort') as ListProductsSort) || 'newest',
    tags: (p.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean),
    minPrice: p.get('minPrice') || '',
    maxPrice: p.get('maxPrice') || '',
  };
}

export default function ProductsPage() {
  const initial = readUrlParams();
  const [search, setSearchRaw] = useState(initial.search);
  const [searchInput, setSearchInput] = useState(initial.search);
  const [category, setCategory] = useState(initial.category);
  const [sort, setSort] = useState<ListProductsSort>(initial.sort);
  const [selectedTags, setSelectedTags] = useState<string[]>(initial.tags);
  const [minPrice, setMinPrice] = useState(initial.minPrice);
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice);
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isResetting = useRef(false);

  const { data: categories } = useListCategories();
  const searchString = useSearch();

  const selectedCategoryId =
    category !== 'all' ? categories?.find((c) => c.slug === category)?.id : undefined;

  // Category context for breadcrumb + subcategory pills, from the flat list.
  const currentCategory = categories?.find((c) => c.slug === category) ?? null;
  const parentCategory = currentCategory?.parentId != null
    ? categories?.find((c) => c.id === currentCategory.parentId) ?? null
    : null;
  const childCategories = currentCategory
    ? (categories ?? []).filter((c) => c.parentId === currentCategory.id)
    : [];

  // Available facets for the current collection (tags + price range).
  const { data: facets } = useQuery({
    queryKey: ['facets', selectedCategoryId ?? 'all'],
    queryFn: () => fetchFacets(selectedCategoryId),
  });

  const { data: productsPage, isLoading, isFetching } = useListProducts(
    {
      search: search || undefined,
      category: selectedCategoryId,
      sort,
      page,
      limit: PAGE_SIZE,
      tags: selectedTags.length ? selectedTags.join(',') : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
    },
    {
      query: {
        queryKey: ['products', search, selectedCategoryId, sort, page, selectedTags.join(','), minPrice, maxPrice],
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

  // Shared reset when any filter changes: back to page 1, clear the list.
  const resetList = useCallback(() => {
    isResetting.current = true;
    setPage(1);
    setAllProducts([]);
    setHasMore(true);
  }, []);

  // Changing search/category/sort. Switching category clears the tag + price
  // facets, since they belong to the previous collection.
  const applyFilters = useCallback(
    (newSearch: string, newCategory: string, newSort: ListProductsSort) => {
      resetList();
      setSearchRaw(newSearch);
      if (newCategory !== category) {
        setSelectedTags([]);
        setMinPrice('');
        setMaxPrice('');
      }
      setCategory(newCategory);
      setSort(newSort);
    },
    [category, resetList],
  );

  const toggleTag = (tag: string) => {
    resetList();
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const applyPriceRange = (min: string, max: string) => {
    resetList();
    setMinPrice(min);
    setMaxPrice(max);
  };

  // Debounced search input
  const handleSearchInput = (val: string) => {
    setSearchInput(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      applyFilters(val, category, sort);
    }, 350);
  };

  const handleCategory = (slug: string) => applyFilters(search, slug, sort);
  const handleSort = (val: ListProductsSort) => applyFilters(search, category, val);

  // Pull filters in from the URL when navigation changes the query string
  // (e.g. a mega-menu link clicked while already on /products).
  useEffect(() => {
    const u = readUrlParams();
    const changed =
      u.search !== search ||
      u.category !== category ||
      u.sort !== sort ||
      u.tags.join(',') !== selectedTags.join(',') ||
      u.minPrice !== minPrice ||
      u.maxPrice !== maxPrice;
    if (changed) {
      resetList();
      setSearchInput(u.search);
      setSearchRaw(u.search);
      setCategory(u.category);
      setSort(u.sort);
      setSelectedTags(u.tags);
      setMinPrice(u.minPrice);
      setMaxPrice(u.maxPrice);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString]);

  // Sync URL (no page reload)
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (category !== 'all') params.set('category', category);
    if (sort !== 'newest') params.set('sort', sort);
    if (selectedTags.length) params.set('tags', selectedTags.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    const url = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.pushState({}, '', url);
  }, [search, category, sort, selectedTags, minPrice, maxPrice]);

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

  const saveScroll = () => {
    sessionStorage.setItem('productsScrollY', String(window.scrollY));
  };

  const total = productsPage?.total ?? 0;
  const priceActive = Boolean(minPrice || maxPrice);
  const activeFiltersCount =
    (search ? 1 : 0) + (category !== 'all' ? 1 : 0) + (sort !== 'newest' ? 1 : 0) + selectedTags.length + (priceActive ? 1 : 0);

  const clearAll = () => {
    setSearchInput('');
    resetList();
    setSearchRaw('');
    setCategory('all');
    setSort('newest');
    setSelectedTags([]);
    setMinPrice('');
    setMaxPrice('');
  };

  const heading = currentCategory?.name ?? 'All Products';

  return (
    <StorefrontLayout>
      {/* Page header */}
      <div className="bg-muted/30 border-b py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Link href="/products" className="hover:text-primary">Shop</Link>
            {parentCategory && (
              <>
                <ChevronRight className="w-3 h-3" />
                <button className="hover:text-primary" onClick={() => handleCategory(parentCategory.slug)}>
                  {parentCategory.name}
                </button>
              </>
            )}
            {currentCategory && (
              <>
                <ChevronRight className="w-3 h-3" />
                <span className="text-foreground font-medium">{currentCategory.name}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{heading}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {total > 0 ? `${total} products` : 'Browse our complete catalogue'}
              </p>
            </div>
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

          {/* Subcategory pills — child collections of the current category */}
          {childCategories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {childCategories.map((sub) => (
                <button
                  key={sub.slug}
                  onClick={() => handleCategory(sub.slug)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-background border border-border rounded-full px-3.5 py-1.5 hover:border-primary hover:text-primary transition-colors"
                >
                  {sub.name}
                  <span className="text-muted-foreground/60">{sub.productCount ?? 0}</span>
                </button>
              ))}
            </div>
          )}
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
              {[{ id: 0, name: 'All Categories', slug: 'all', parentId: null }, ...(categories || [])]
                // Show only top-level categories + the active branch to keep the
                // list tidy; subcategories are reachable via the pills / mega-menu.
                .filter((c) => c.slug === 'all' || c.parentId == null || c.slug === category || c.id === currentCategory?.parentId)
                .map((cat) => (
                  <li key={cat.slug}>
                    <button
                      onClick={() => handleCategory(cat.slug)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                        category === cat.slug
                          ? 'bg-primary/10 text-primary font-bold'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                        cat.parentId != null && 'pl-6 text-[13px]',
                      )}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          {/* Price range */}
          {facets && facets.priceRange.max > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3">
                Price (KES)
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={String(facets.priceRange.min)}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="h-9 text-sm"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder={String(facets.priceRange.max)}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2 h-8 text-xs font-semibold"
                onClick={() => applyPriceRange(minPrice, maxPrice)}
              >
                Apply price
              </Button>
            </div>
          )}

          {/* Tag facets */}
          {facets && facets.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <Tag className="w-3 h-3" /> Refine
              </p>
              <div className="flex flex-wrap gap-1.5">
                {facets.tags.map((t) => {
                  const active = selectedTags.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      onClick={() => toggleTag(t.value)}
                      className={cn(
                        'inline-flex items-center gap-1 text-xs rounded-full px-3 py-1.5 border transition-colors capitalize',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {t.value.replace(/-/g, ' ')}
                      <span className={cn('text-[10px]', active ? 'text-primary-foreground/70' : 'text-muted-foreground/50')}>
                        {t.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
              onClick={clearAll}
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
                  {currentCategory?.name || category}
                  <button onClick={() => applyFilters(search, 'all', sort)}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </span>
              )}
              {selectedTags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20 capitalize">
                  {t.replace(/-/g, ' ')}
                  <button onClick={() => toggleTag(t)}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </span>
              ))}
              {priceActive && (
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20">
                  {minPrice ? formatCurrency(Number(minPrice)) : formatCurrency(0)} – {maxPrice ? formatCurrency(Number(maxPrice)) : '∞'}
                  <button onClick={() => applyPriceRange('', '')}>
                    <X className="w-3 h-3 ml-0.5" />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Grid */}
          {isLoading && page === 1 ? (
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
              <Button variant="outline" className="mt-4" onClick={clearAll}>
                Clear Filters
              </Button>
            </div>
          ) : (
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
