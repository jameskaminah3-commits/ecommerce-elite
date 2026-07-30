import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  className?: string;
}

/**
 * Pixel-matched skeleton for ProductCard.
 * Explicit aspect-square image area + text rows prevents CLS.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-card rounded-xl border border-border/60 overflow-hidden',
        className,
      )}
      aria-hidden="true"
    >
      {/* Image placeholder — exact aspect-square match */}
      <div className="aspect-square w-full bg-muted relative overflow-hidden">
        <div className="skeleton-shimmer absolute inset-0" />
      </div>

      {/* Content rows */}
      <div className="p-4 flex flex-col gap-2.5">
        {/* Category label */}
        <div className="h-2.5 w-16 rounded bg-muted relative overflow-hidden">
          <div className="skeleton-shimmer absolute inset-0" />
        </div>
        {/* Product name — 2 lines */}
        <div className="space-y-1.5">
          <div className="h-3.5 w-full rounded bg-muted relative overflow-hidden">
            <div className="skeleton-shimmer absolute inset-0" />
          </div>
          <div className="h-3.5 w-3/4 rounded bg-muted relative overflow-hidden">
            <div className="skeleton-shimmer absolute inset-0" />
          </div>
        </div>
        {/* Price + rating row */}
        <div className="flex items-end justify-between pt-1">
          <div className="h-5 w-20 rounded bg-muted relative overflow-hidden">
            <div className="skeleton-shimmer absolute inset-0" />
          </div>
          <div className="h-3.5 w-14 rounded bg-muted relative overflow-hidden">
            <div className="skeleton-shimmer absolute inset-0" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-width skeleton row matching the hero category card (aspect-[3/4]) */
export function SkeletonCategoryCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={cn('rounded-xl bg-muted overflow-hidden aspect-[3/4] relative', className)}
      aria-hidden="true"
    >
      <div className="skeleton-shimmer absolute inset-0" />
    </div>
  );
}
