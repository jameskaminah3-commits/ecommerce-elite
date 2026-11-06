import React from 'react';
import { classNames } from '@/lib/utils';

// The Happyfine emblem (gold house on forest green) with a stacked wordmark.
// tone="dark" for light backgrounds (storefront), "light" for dark backgrounds (admin).
export function BrandLogo({
  size = 40,
  tone = 'dark',
  wordmark = true,
  subline = 'Wholesalers',
  className,
}: {
  size?: number;
  tone?: 'dark' | 'light';
  wordmark?: boolean;
  subline?: string;
  className?: string;
}) {
  return (
    <span className={classNames('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src={size > 48 ? '/logo-192.webp' : '/logo-96.webp'}
        alt={wordmark ? '' : 'Happyfine Wholesalers'}
        width={size}
        height={size}
        decoding="async"
        className="shrink-0 rounded-full shadow-sm shadow-black/20"
        style={{ width: size, height: size }}
      />
      {wordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={classNames(
              'font-extrabold tracking-tight text-[17px]',
              tone === 'light' ? 'text-white' : 'text-secondary',
            )}
          >
            Happyfine
          </span>
          <span
            className={classNames(
              'mt-[3px] text-[9.5px] font-bold uppercase tracking-[0.24em]',
              tone === 'light' ? 'text-[#f5b301]' : 'text-primary',
            )}
          >
            {subline}
          </span>
        </span>
      )}
    </span>
  );
}
