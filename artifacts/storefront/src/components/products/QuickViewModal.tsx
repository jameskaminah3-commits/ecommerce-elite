import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useGetProduct } from '@workspace/api-client-react';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/utils';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Star, ShoppingBag, ArrowRight, Minus, Plus } from 'lucide-react';

interface QuickViewModalProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({ productId, isOpen, onClose }: QuickViewModalProps) {
  const { data: product, isLoading } = useGetProduct(productId!, {
    query: { queryKey: ['/api/products', productId], enabled: isOpen && !!productId } as any,
  });
  const { addItem, isAdding } = useCart();
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variants = product?.variants || [];
  const selectedVariant = variants.find((v) => v.id === selectedVariantId) || variants[0];

  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [variants]);

  const colors = [...new Set(variants.filter((v) => v.color).map((v) => v.color as string))];
  const sizes = [...new Set(variants.filter((v) => v.size).map((v) => v.size as string))];

  const displayPrice = selectedVariant?.price ?? product?.basePrice ?? 0;
  const inStock = selectedVariant ? (selectedVariant.stock ?? 0) > 0 : true;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 border-0 shadow-2xl">
        {isLoading || !product ? (
          <div className="h-96 flex items-center justify-center bg-muted">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[480px]">
            {/* Image */}
            <div className="relative bg-muted overflow-hidden">
              <img
                src={product.imageUrl || ''}
                alt={product.name}
                className="w-full h-full object-cover"
                style={{ minHeight: 320 }}
              />
              {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                <div className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-xs font-bold px-2.5 py-1 rounded">
                  SALE
                </div>
              )}
            </div>

            {/* Details */}
            <div className="p-7 flex flex-col">
              <p className="text-[10px] font-bold text-primary uppercase tracking-[0.12em] mb-2">
                {product.categoryName}
              </p>
              <h2 className="text-xl font-extrabold tracking-tight leading-tight mb-3">
                {product.name}
              </h2>

              {(product.rating || product.reviewCount) ? (
                <div className="flex items-center gap-1.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${
                        s <= Math.round(product.rating || 0)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-muted-foreground/30 fill-muted-foreground/10'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({product.reviewCount} reviews)
                  </span>
                </div>
              ) : null}

              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-2xl font-bold text-primary tracking-tight">
                  {formatCurrency(displayPrice)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatCurrency(product.compareAtPrice)}
                  </span>
                )}
              </div>

              {product.description && (
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 line-clamp-2 border-t pt-4">
                  {product.description}
                </p>
              )}

              {/* Color picker */}
              {colors.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2">
                    Color — <span className="text-primary">{selectedVariant?.color}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => {
                          const v = variants.find((v) => v.color === color);
                          if (v) setSelectedVariantId(v.id);
                        }}
                        className={`px-3 py-1 text-xs border rounded font-medium transition-all ${
                          selectedVariant?.color === color
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size picker */}
              {sizes.length > 0 && (
                <div className="mb-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          const v = variants.find((v) => v.size === size);
                          if (v) setSelectedVariantId(v.id);
                        }}
                        className={`w-10 h-10 text-xs border rounded font-bold transition-all ${
                          selectedVariant?.size === size
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto space-y-2.5">
                {/* Quantity + Add */}
                <div className="flex gap-2">
                  <div className="flex items-center border rounded-md h-11">
                    <button
                      className="px-3 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold">{quantity}</span>
                    <button
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setQuantity((q) => q + 1)}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Button
                    className="flex-1 h-11 font-bold"
                    onClick={() => {
                      if (selectedVariant) {
                        addItem(selectedVariant.id, quantity);
                        onClose();
                      }
                    }}
                    disabled={isAdding || !selectedVariant || !inStock}
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    {isAdding ? 'Adding...' : !inStock ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                </div>

                <Button asChild variant="ghost" className="w-full h-9 text-sm" onClick={onClose}>
                  <Link href={`/products/${product.id}`}>
                    View Full Details <ArrowRight className="w-3.5 h-3.5 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
