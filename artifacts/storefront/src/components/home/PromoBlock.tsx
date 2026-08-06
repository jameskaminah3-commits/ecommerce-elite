import React from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import styles from './PromoBlock.module.css';

export interface HomepageBlock {
  id: number;
  kind: 'image' | 'color' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  backgroundColor: string | null;
  overlayOpacity: number;
  columnSpan: number;
  hideOnMobile: boolean;
  aspectRatio: string;
  heading: string | null;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  textAlign: string;
  textColor: string;
  sortOrder: number;
  active: boolean;
}

const V_ALIGN: Record<string, string> = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
const H_ALIGN: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' };
const TEXT_ALIGN: Record<string, string> = { left: 'left', center: 'center', right: 'right' };

function alignment(textAlign: string) {
  const [vRaw, hRaw] = (textAlign || 'bottom-left').split('-');
  const v = V_ALIGN[vRaw] ?? 'flex-end';
  const h = H_ALIGN[hRaw] ?? 'flex-start';
  return { v, h, text: TEXT_ALIGN[hRaw] ?? 'left' };
}

// Normalize "16/9" or "16 / 9" into a valid CSS aspect-ratio value.
function aspect(value: string): string {
  const cleaned = (value || '16/9').replace(/\s+/g, '');
  const [w, h] = cleaned.split('/');
  return w && h ? `${w} / ${h}` : '16 / 9';
}

export function PromoBlock({ block }: { block: HomepageBlock }) {
  const { v, h, text } = alignment(block.textAlign);

  const style = {
    ['--col-span' as any]: String(Math.min(Math.max(block.columnSpan, 1), 12)),
    ['--aspect' as any]: aspect(block.aspectRatio),
    ['--overlay' as any]: String(Math.min(Math.max(block.overlayOpacity, 0), 100) / 100),
    ['--text-color' as any]: block.textColor || '#ffffff',
    ['--v-align' as any]: v,
    ['--h-align' as any]: h,
    ['--text-align' as any]: text,
    ['--bg' as any]: block.kind === 'color' ? block.backgroundColor || '#111827' : '#111827',
  } as React.CSSProperties;

  const className = block.hideOnMobile ? `${styles.block} ${styles.hideMobile}` : styles.block;
  const hasText = block.heading || block.subheading || block.ctaLabel;

  return (
    <div className={className} style={style}>
      {block.kind === 'video' && block.videoUrl ? (
        <video
          className={styles.media}
          autoPlay
          muted
          loop
          playsInline
          poster={block.imageUrl ?? undefined}
        >
          <source src={block.videoUrl} />
        </video>
      ) : block.kind === 'image' && block.imageUrl ? (
        <img className={styles.media} src={block.imageUrl} alt={block.heading ?? ''} loading="lazy" />
      ) : null}

      {(block.kind === 'image' || block.kind === 'video') && block.overlayOpacity > 0 && (
        <div className={styles.overlay} />
      )}

      {hasText && (
        <div className={styles.content}>
          {block.heading && <h3 className={styles.heading}>{block.heading}</h3>}
          {block.subheading && <p className={styles.subheading}>{block.subheading}</p>}
          {block.ctaLabel && (
            <span className={styles.cta}>
              {block.ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      )}

      {block.ctaHref && (
        <Link href={block.ctaHref} className={styles.link} aria-label={block.heading ?? block.ctaLabel ?? 'Promotion'} />
      )}
    </div>
  );
}

export function PromoGrid({ blocks }: { blocks: HomepageBlock[] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className={styles.grid}>
      {blocks.map((b) => (
        <PromoBlock key={b.id} block={b} />
      ))}
    </div>
  );
}
