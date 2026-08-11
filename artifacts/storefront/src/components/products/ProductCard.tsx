import React, { useState } from 'react';
import { Product } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { formatCurrency, classNames, getPriceInfo } from '@/lib/utils';
import { ShoppingBag, Star, Eye } from 'lucide-react';
import { QuickViewModal } from './QuickViewModal';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const { price, original, discountPct, onSale } = getPriceInfo(product);
  const soldOut = (product as { totalStock?: number }).totalStock === 0;

  return (
    <>
      <div className={classNames('group relative flex flex-col', className)}>
        {/* Image on a soft, product-on-light panel */}
        <div className="relative aspect-square rounded-2xl bg-muted/40 overflow-hidden ring-1 ring-border/50 transition-all duration-500 group-hover:ring-border group-hover:shadow-lg group-hover:shadow-black/5">
          <Link href={`/products/${product.id}`} className="block w-full h-full">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className={classNames(
                  'w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]',
                  soldOut && 'opacity-70',
                )}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-secondary/25">
                <ShoppingBag className="w-11 h-11" />
              </div>
            )}
          </Link>

          {/* Quiet badges */}
          <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5">
            {soldOut ? (
              <span className="bg-background/90 backdrop-blur-sm text-foreground/70 text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wide shadow-sm">
                Sold out
              </span>
            ) : onSale ? (
              <span className="bg-secondary text-secondary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full tracking-wide">
                –{discountPct}%
              </span>
            ) : null}
          </div>

          {/* Hover actions */}
          {!soldOut && (
            <div className="absolute inset-x-0 bottom-0 p-3 flex gap-2 opacity-0 translate-y-3 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
              <button
                onClick={() => setQuickViewOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-background/95 backdrop-blur-sm text-foreground text-xs font-semibold rounded-full border border-border/60 shadow-md hover:bg-secondary hover:text-secondary-foreground hover:border-secondary transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Quick view
              </button>
              <Link
                href={`/products/${product.id}`}
                className="flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-md hover:bg-primary/90 transition-colors shrink-0"
                title="View details"
              >
                <ShoppingBag className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Content — airy, quiet hierarchy */}
        <div className="pt-3.5 px-0.5 flex flex-col">
          <div className="text-[11px] text-muted-foreground/80 mb-1 tracking-wide">
            {product.categoryName || 'General'}
          </div>

          <Link href={`/products/${product.id}`}>
            <h3 className="font-medium text-sm text-foreground/90 leading-snug line-clamp-1 group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </Link>

          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-[15px] tracking-tight text-foreground">
                {formatCurrency(price)}
              </span>
              {onSale && original != null && (
                <span className="text-xs text-muted-foreground/70 line-through">
                  {formatCurrency(original)}
                </span>
              )}
            </div>

            {(product.rating || product.reviewCount) ? (
              <div className="flex items-center text-[11px] text-muted-foreground shrink-0">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 mr-0.5" />
                <span className="font-medium text-foreground/80">{product.rating?.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <QuickViewModal
        productId={product.id}
        isOpen={quickViewOpen}
        onClose={() => setQuickViewOpen(false)}
      />
    </>
  );
}
