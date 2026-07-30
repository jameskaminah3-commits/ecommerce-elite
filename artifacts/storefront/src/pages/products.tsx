import React, { useState } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useListProducts, useListCategories, ListProductsSort } from '@workspace/api-client-react';
import { ProductCard } from '@/components/products/ProductCard';
import { Search, Filter, SlidersHorizontal } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export default function ProductsPage() {
  const [searchParams] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category');
  
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(initialCategory || 'all');
  const [sort, setSort] = useState<ListProductsSort>('newest');
  
  const { data: categories } = useListCategories();
  
  // Find category ID if a slug is selected
  const selectedCategoryId = category !== 'all' 
    ? categories?.find(c => c.slug === category)?.id 
    : undefined;

  const { data: productsData, isLoading } = useListProducts({
    query: {
      queryKey: ['products', search, selectedCategoryId, sort],
    }
  });

  return (
    <StorefrontLayout>
      <div className="bg-muted/30 border-b py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">All Products</h1>
          <p className="text-muted-foreground mt-2">Browse our complete catalogue of premium goods.</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4 font-bold pb-2 border-b">
              <Filter className="w-4 h-4" />
              <span>Categories</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="cat-all" 
                  checked={category === 'all'} 
                  onCheckedChange={() => setCategory('all')} 
                />
                <Label htmlFor="cat-all" className="text-sm font-medium leading-none cursor-pointer">
                  All Categories
                </Label>
              </div>
              {categories?.map((cat) => (
                <div key={cat.id} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`cat-${cat.slug}`} 
                    checked={category === cat.slug} 
                    onCheckedChange={() => setCategory(cat.slug)} 
                  />
                  <Label htmlFor={`cat-${cat.slug}`} className="text-sm font-medium leading-none cursor-pointer">
                    {cat.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2 mb-4 font-bold pb-2 border-b">
              <SlidersHorizontal className="w-4 h-4" />
              <span>Price Range</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Min KES" className="text-sm" />
              <Input type="number" placeholder="Max KES" className="text-sm" />
            </div>
            <Button variant="outline" className="w-full mt-3 h-8 text-xs">Apply Range</Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..." 
                className="pl-9"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">
                {productsData?.total || 0} products
              </span>
              <Select value={sort} onValueChange={(val) => setSort(val as ListProductsSort)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Sort by" />
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

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-[400px] bg-card border rounded-xl animate-pulse" />
              ))}
            </div>
          ) : productsData?.items.length === 0 ? (
            <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
              <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold">No products found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your filters or search query.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setCategory('all'); setSearch(''); }}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {productsData?.items.map((product, i) => (
                <div key={product.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{ animationDelay: `${(i % 6) * 50}ms` }}>
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination mockup */}
          {productsData && productsData.total > (productsData.limit || 20) && (
            <div className="mt-12 flex justify-center">
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled>Previous</Button>
                <Button variant="default">1</Button>
                <Button variant="outline">2</Button>
                <Button variant="outline">3</Button>
                <Button variant="outline">Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </StorefrontLayout>
  );
}
