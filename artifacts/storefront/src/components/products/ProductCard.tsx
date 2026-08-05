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

  return (
    <>
      <div
        className={classNames(
          'group relative flex flex-col bg-card rounded-xl border border-border/60 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 hover:border-border',
          className,
        )}
      >
        {/* Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {onSale && (
            <span className="bg-destructive text-destructive-foreground text-[9px] font-black px-2 py-0.5 rounded tracking-wider">
              -{discountPct}%
            </span>
          )}
          {product.featured && (
            <span className="bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded tracking-wider">
              FEATURED
            </span>
          )}
        </div>

        {/* Image */}
        <div className="aspect-square block bg-muted overflow-hidden relative">
          <Link href={`/products/${product.id}`}>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary/5 text-secondary/30">
                <ShoppingBag className="w-12 h-12" />
              </div>
            )}
          </Link>

          {/* Hover actions */}
          <div className="absolute inset-x-0 bottom-0 p-3 flex gap-2 opacity-0 translate-y-3 transition-all duration-250 group-hover:opacity-100 group-hover:translate-y-0">
            <button
              onClick={() => setQuickViewOpen(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-background/95 backdrop-blur-sm text-foreground text-xs font-bold rounded-lg border border-border/60 shadow-lg hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Quick View
            </button>
            <Link
              href={`/products/${product.id}`}
              className="flex items-center justify-center w-9 h-9 bg-primary text-primary-foreground rounded-lg shadow-lg hover:bg-primary/90 transition-colors shrink-0"
              title="View details"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <div className="text-[10px] text-muted-foreground mb-1 font-bold tracking-[0.1em] uppercase">
            {product.categoryName || 'General'}
          </div>

          <Link href={`/products/${product.id}`} className="mb-3">
            <h3 className="font-semibold text-[13px] text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors">
              {product.name}
            </h3>
          </Link>

          <div className="mt-auto flex items-end justify-between gap-2">
            <div>
              {onSale && original != null && (
                <span className="text-[11px] text-muted-foreground line-through block leading-none mb-0.5">
                  {formatCurrency(original)}
                </span>
              )}
              <span className={classNames(
                'font-extrabold text-base tracking-tight leading-none',
                onSale ? 'text-destructive' : 'text-primary',
              )}>
                {formatCurrency(price)}
              </span>
            </div>

            {(product.rating || product.reviewCount) ? (
              <div className="flex items-center text-[11px] text-muted-foreground shrink-0">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 mr-0.5" />
                <span className="font-semibold text-foreground">{product.rating?.toFixed(1)}</span>
                <span className="opacity-60 ml-0.5">({product.reviewCount})</span>
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
