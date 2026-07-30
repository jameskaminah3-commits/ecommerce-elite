import React, { useState, useCallback } from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { useGetProduct, ProductVariant } from '@workspace/api-client-react';
import { useCart } from '@/contexts/CartContext';
import { useParams } from 'wouter';
import { formatCurrency, classNames, cn } from '@/lib/utils';
import { Star, Truck, ShieldCheck, ChevronRight, Minus, Plus, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { SkeletonCard } from '@/components/products/SkeletonCard';

// Map variant color names → CSS swatches
const COLOR_SWATCH: Record<string, string> = {
  black: '#1a1a1a',
  white: '#f5f5f5',
  grey: '#9e9e9e',
  gray: '#9e9e9e',
  navy: '#001f3f',
  'navy blue': '#001f3f',
  silver: '#c0c0c0',
  blue: '#2196f3',
  'floral blue': '#4a90d9',
  red: '#e53935',
  pink: '#e91e8c',
  purple: '#9c27b0',
  turquoise: '#00bcd4',
  terracotta: '#c1440e',
  gold: '#ffd700',
  orange: '#ff9800',
  green: '#4caf50',
  charcoal: '#36454f',
};

function getSwatchColor(color: string) {
  return COLOR_SWATCH[color.toLowerCase()] ?? null;
}

// Skeleton for the product detail page
function ProductDetailSkeleton() {
  return (
    <StorefrontLayout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-16">
          {/* Image skeleton */}
          <div className="w-full md:w-1/2 space-y-4">
            <div className="aspect-square bg-muted rounded-2xl relative overflow-hidden">
              <div className="skeleton-shimmer absolute inset-0" />
            </div>
            <div className="flex gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-20 bg-muted rounded-lg relative overflow-hidden shrink-0">
                  <div className="skeleton-shimmer absolute inset-0" />
                </div>
              ))}
            </div>
          </div>
          {/* Details skeleton */}
          <div className="w-full md:w-1/2 space-y-4">
            <div className="h-3 w-24 bg-muted rounded relative overflow-hidden"><div className="skeleton-shimmer absolute inset-0" /></div>
            <div className="h-9 w-full bg-muted rounded relative overflow-hidden"><div className="skeleton-shimmer absolute inset-0" /></div>
            <div className="h-9 w-3/4 bg-muted rounded relative overflow-hidden"><div className="skeleton-shimmer absolute inset-0" /></div>
            <div className="h-5 w-32 bg-muted rounded relative overflow-hidden mt-2"><div className="skeleton-shimmer absolute inset-0" /></div>
            <div className="h-10 w-40 bg-muted rounded relative overflow-hidden mt-4"><div className="skeleton-shimmer absolute inset-0" /></div>
            <div className="h-24 w-full bg-muted rounded-xl relative overflow-hidden mt-6"><div className="skeleton-shimmer absolute inset-0" /></div>
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const productId = parseInt(id || '0', 10);

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { enabled: !!productId },
  });

  const { addItem, isAdding } = useCart();
  const { toast } = useToast();

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [imageTransitioning, setImageTransitioning] = useState(false);

  // Initialize on data load
  React.useEffect(() => {
    if (product?.variants?.length && !selectedVariant) {
      setSelectedVariant(product.variants[0]);
    }
    if (product?.imageUrl && !activeImage) {
      setActiveImage(product.imageUrl);
    }
  }, [product]);

  // Smooth image transition when switching variants
  const switchImage = useCallback((img: string) => {
    if (img === activeImage) return;
    setImageTransitioning(true);
    setTimeout(() => {
      setActiveImage(img);
      setImageTransitioning(false);
    }, 120);
  }, [activeImage]);

  const selectVariant = useCallback((v: ProductVariant) => {
    setSelectedVariant(v);
    if (v.imageUrl) switchImage(v.imageUrl);
    else if (product?.imageUrl) switchImage(product.imageUrl);
  }, [product, switchImage]);

  const handleAddToCart = () => {
    if (!selectedVariant) {
      toast({ title: 'Please select an option', variant: 'destructive' });
      return;
    }
    if ((selectedVariant.stock ?? 0) < quantity) {
      toast({ title: 'Not enough stock', description: `Only ${selectedVariant.stock} available.`, variant: 'destructive' });
      return;
    }
    addItem(selectedVariant.id, quantity);
  };

  if (isLoading) return <ProductDetailSkeleton />;
  if (!product) {
    return (
      <StorefrontLayout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">Product not found</h2>
          <Button asChild variant="outline" className="mt-4"><a href="/products">Back to products</a></Button>
        </div>
      </StorefrontLayout>
    );
  }

  const colors = Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean))) as string[];
  const displayPrice = selectedVariant?.price ?? product.basePrice;
  const stockCount = selectedVariant?.stock ?? 0;
  const inStock = stockCount > 0;
  const lowStock = inStock && stockCount <= 5;

  const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean) as string[];

  return (
    <StorefrontLayout>
      {/* Breadcrumbs */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3 text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <a href="/" className="hover:text-foreground transition-colors">Home</a>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <a href={`/products?category=${product.categorySlug || ''}`} className="hover:text-foreground transition-colors">
            {product.categoryName || 'Products'}
          </a>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-foreground font-medium truncate max-w-xs">{product.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-10 lg:gap-16">

          {/* ── Images ────────────────────────────────────────────────── */}
          <div className="w-full md:w-1/2 flex flex-col gap-4">
            {/* Main image */}
            <div
              className="aspect-square bg-muted rounded-2xl overflow-hidden border relative"
              style={{ willChange: 'transform' }}
            >
              <img
                src={activeImage || ''}
                alt={product.name}
                className={cn(
                  'w-full h-full object-cover transition-opacity duration-150',
                  imageTransitioning ? 'opacity-0' : 'opacity-100',
                )}
                style={{ willChange: 'opacity' }}
              />
              {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-xs font-black px-2.5 py-1 rounded">
                  -{Math.round(((product.compareAtPrice - product.basePrice) / product.compareAtPrice) * 100)}% OFF
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => switchImage(img)}
                    className={cn(
                      'w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-150',
                      activeImage === img
                        ? 'border-primary ring-2 ring-primary/20 ring-offset-1'
                        : 'border-border/40 hover:border-primary/50 opacity-70 hover:opacity-100',
                    )}
                    style={{ willChange: 'transform' }}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Details ───────────────────────────────────────────────── */}
          <div className="w-full md:w-1/2 flex flex-col">
            {product.categoryName && (
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary mb-2">
                {product.categoryName}
              </p>
            )}

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mb-4 leading-tight">
              {product.name}
            </h1>

            {/* Stars + stock */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={cn(
                      'w-4 h-4',
                      s <= Math.round(product.rating || 0)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-muted-foreground/25 fill-muted-foreground/10',
                    )}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1.5 font-medium">
                  {product.rating?.toFixed(1)} ({product.reviewCount} reviews)
                </span>
              </div>
              <span className="text-muted-foreground/30">|</span>
              <span className={cn('text-sm font-bold flex items-center gap-1', inStock ? 'text-emerald-600' : 'text-destructive')}>
                {inStock ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {lowStock ? `Only ${stockCount} left` : 'In Stock'}
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" />
                    Out of Stock
                  </>
                )}
              </span>
            </div>

            {/* Price — updates instantly on variant change */}
            <div className="flex items-baseline gap-3 mb-7">
              <span
                className="text-4xl font-extrabold tracking-tight text-foreground transition-all duration-150"
                style={{ willChange: 'contents' }}
              >
                {formatCurrency(displayPrice)}
              </span>
              {product.compareAtPrice && product.compareAtPrice > displayPrice && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>

            {/* Variant selectors */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-5 mb-7">

                {/* Color swatches */}
                {colors.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-2.5">
                      Color —{' '}
                      <span className="text-primary font-bold normal-case tracking-normal text-xs">
                        {selectedVariant?.color}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {colors.map((color) => {
                        const swatch = getSwatchColor(color);
                        const isAvailable = product.variants.some((v) => v.color === color && (v.stock ?? 0) > 0);
                        const isSelected = selectedVariant?.color === color;

                        return (
                          <button
                            key={color}
                            disabled={!isAvailable}
                            onClick={() => {
                              const v =
                                product.variants.find(
                                  (v) => v.color === color && v.size === selectedVariant?.size,
                                ) || product.variants.find((v) => v.color === color);
                              if (v) selectVariant(v);
                            }}
                            title={color}
                            className={cn(
                              'relative transition-all duration-150 focus:outline-none',
                              !isAvailable && 'opacity-40 cursor-not-allowed',
                            )}
                            style={{ willChange: 'transform' }}
                          >
                            {swatch ? (
                              // Circle swatch
                              <span
                                className={cn(
                                  'block w-8 h-8 rounded-full border-2 transition-all duration-150',
                                  isSelected
                                    ? 'border-primary ring-2 ring-primary ring-offset-2 scale-110'
                                    : 'border-border hover:border-primary/60 hover:scale-105',
                                )}
                                style={{ background: swatch }}
                              />
                            ) : (
                              // Text chip fallback
                              <span
                                className={cn(
                                  'block px-3 py-1.5 text-xs font-medium border rounded-md transition-all duration-150',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border hover:border-primary/50',
                                )}
                              >
                                {color}
                              </span>
                            )}
                            {!isAvailable && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-[1px] h-9 bg-destructive/60 rotate-45 block" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Size tiles */}
                {sizes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] mb-2.5">Size</p>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size) => {
                        const isAvailable = product.variants.some(
                          (v) => v.size === size && (v.stock ?? 0) > 0,
                        );
                        const isSelected = selectedVariant?.size === size;

                        return (
                          <button
                            key={size}
                            disabled={!isAvailable}
                            onClick={() => {
                              const v =
                                product.variants.find(
                                  (v) => v.size === size && v.color === selectedVariant?.color,
                                ) || product.variants.find((v) => v.size === size);
                              if (v) selectVariant(v);
                            }}
                            className={cn(
                              'min-w-[2.75rem] h-10 px-3 border rounded-md text-xs font-bold transition-all duration-150',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-card hover:border-primary/60',
                              !isAvailable && 'opacity-40 cursor-not-allowed line-through',
                            )}
                            style={{ willChange: 'transform' }}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quantity + Add to cart */}
            <div className="bg-muted/40 p-5 rounded-xl border border-border/50 mb-7">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Quantity</span>
                {selectedVariant && (
                  <span className={cn('text-xs font-medium', lowStock ? 'text-amber-600' : 'text-muted-foreground')}>
                    {lowStock ? `Only ${stockCount} left in stock!` : `${stockCount} available`}
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center border border-input bg-background rounded-md h-12 w-full sm:w-32 shrink-0">
                  <button
                    className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 text-center font-bold text-base">{quantity}</div>
                  <button
                    className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={!!selectedVariant && quantity >= (selectedVariant.stock ?? 0)}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <Button
                  size="lg"
                  className="flex-1 h-12 text-sm font-bold shadow-lg shadow-primary/20 transition-all duration-150"
                  onClick={handleAddToCart}
                  disabled={!selectedVariant || !inStock || isAdding}
                  style={{ willChange: 'transform' }}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  {isAdding
                    ? 'Adding...'
                    : !selectedVariant
                    ? 'Select Options'
                    : !inStock
                    ? 'Out of Stock'
                    : 'Add to Cart'}
                </Button>
              </div>
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-3 mb-7">
              <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-card">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="font-bold text-xs">Fast Delivery</p>
                  <p className="text-muted-foreground text-[11px]">Across Kenya</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl border bg-card">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="font-bold text-xs">Authentic</p>
                  <p className="text-muted-foreground text-[11px]">100% Guaranteed</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <div className="border-t pt-6">
                <h3 className="font-bold text-sm mb-3 uppercase tracking-wide">Product Details</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </StorefrontLayout>
  );
}
