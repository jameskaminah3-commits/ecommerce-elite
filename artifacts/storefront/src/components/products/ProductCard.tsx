import React from 'react';
import { Product } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { formatCurrency, classNames } from '@/lib/utils';
import { ShoppingBag, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductCardProps {
  product: Product;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  // Simple quick add for the base variant, but ideally we'd show options or go to detail page
  
  return (
    <div className={classNames(
      "group relative flex flex-col bg-card rounded-xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20",
      className
    )}>
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
          <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded shadow-sm">
            SALE
          </span>
        )}
        {product.featured && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-1 rounded shadow-sm">
            FEATURED
          </span>
        )}
      </div>

      {/* Image */}
      <Link href={`/products/${product.id}`} className="aspect-square block bg-muted overflow-hidden relative">
        {product.imageUrl ? (
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/5 text-secondary/40">
            <ShoppingBag className="w-12 h-12" />
          </div>
        )}
        
        {/* Quick actions overlay */}
        <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 bg-gradient-to-t from-black/60 to-transparent">
          <Button className="w-full shadow-lg" size="sm" asChild>
            <span>View Details</span>
          </Button>
        </div>
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        <div className="text-xs text-muted-foreground mb-1 font-medium tracking-wide uppercase">
          {product.categoryName || 'General'}
        </div>
        
        <Link href={`/products/${product.id}`} className="mb-2">
          <h3 className="font-semibold text-foreground leading-tight line-clamp-2 hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        
        <div className="mt-auto pt-3 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatCurrency(product.compareAtPrice)}
                </span>
              )}
            </div>
            <span className="font-bold text-lg text-primary tracking-tight">
              {formatCurrency(product.basePrice)}
            </span>
          </div>
          
          {(product.rating || product.reviewCount) ? (
             <div className="flex items-center text-xs text-muted-foreground">
               <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 mr-1" />
               <span className="font-medium text-foreground">{product.rating?.toFixed(1) || '0.0'}</span>
               <span className="ml-1 opacity-70">({product.reviewCount || 0})</span>
             </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
