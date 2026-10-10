import React, { useState } from 'react';
import { Product } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { formatCurrency, classNames, getPriceInfo, productPath } from '@/lib/utils';
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
          <Link href={productPath(product)} className="block w-full h-full">
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

          {/* Phones: one compact round quick-add button (no hover on touch, and a
              wide pill would cover the product photo in a two-column grid). */}
          {!soldOut && (
            <button
              type="button"
              onClick={() => setQuickViewOpen(true)}
              aria-label={`Quick add ${product.name}`}
              className="md:hidden absolute right-2 bottom-2 z-10 w-10 h-10 rounded-full bg-background/95 backdrop-blur-sm text-foreground border border-border/60 shadow-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <ShoppingBag className="w-[18px] h-[18px]" />
            </button>
          )}

          {/* Desktop: pills revealed on hover */}
          {!soldOut && (
            <div className="hidden md:flex absolute inset-x-0 bottom-0 p-3 gap-2 opacity-0 translate-y-3 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
              <button
                onClick={() => setQuickViewOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 whitespace-nowrap bg-background/95 backdrop-blur-sm text-foreground text-xs font-semibold rounded-full border border-border/60 shadow-md hover:bg-secondary hover:text-secondary-foreground hover:border-secondary transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Quick view
              </button>
              <Link
                href={productPath(product)}
                className="flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-md hover:bg-primary/90 transition-colors shrink-0"
                title="View details"
              >
                <ShoppingBag className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Content — each element gets its own line, so a long name, a big price and a
            rating can never collide, even in a narrow two-column phone grid. */}
        <div className="pt-3 px-0.5 flex flex-col">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80 tracking-wide mb-1">
            <span className="truncate">{product.categoryName || 'General'}</span>
            {(product.rating || product.reviewCount) ? (
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="font-medium text-foreground/80 tabular-nums">{product.rating?.toFixed(1)}</span>
              </span>
            ) : null}
          </div>

          <Link href={productPath(product)}>
            <h3 className="font-medium text-[13px] sm:text-sm text-foreground/90 leading-snug line-clamp-2 min-h-[2.55em] group-hover:text-primary transition-colors">
              {product.name}
            </h3>
          </Link>

          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-[15px] tracking-tight text-foreground tabular-nums whitespace-nowrap">
              {formatCurrency(price)}
            </span>
            {onSale && original != null && (
              <span className="text-xs text-muted-foreground/70 line-through tabular-nums whitespace-nowrap">
                {formatCurrency(original)}
              </span>
            )}
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
