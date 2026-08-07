import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import styles from './PromoBlock.module.css';

export interface HomepageBlock {
  id: number;
  placement?: 'hero' | 'grid';
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
// Depth scrim points from the opposite edge toward the text.
const SCRIM_DIR: Record<string, string> = { top: 'to bottom', center: 'to top', bottom: 'to top' };

function alignment(textAlign: string) {
  const [vRaw, hRaw] = (textAlign || 'bottom-left').split('-');
  return {
    v: V_ALIGN[vRaw] ?? 'flex-end',
    h: H_ALIGN[hRaw] ?? 'flex-start',
    text: TEXT_ALIGN[hRaw] ?? 'left',
    scrim: SCRIM_DIR[vRaw] ?? 'to top',
  };
}

// Normalize "16/9" or "16 / 9" into a valid CSS aspect-ratio value.
function aspect(value: string): string {
  const cleaned = (value || '16/9').replace(/\s+/g, '');
  const [w, h] = cleaned.split('/');
  return w && h ? `${w} / ${h}` : '16 / 9';
}

// Reveal on first scroll into view (once).
function useReveal(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    // Safety net: never leave a block stuck hidden if the observer never fires.
    const fallback = window.setTimeout(() => setShown(true), 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [enabled]);
  return { ref, shown };
}

export function PromoBlock({ block, index = 0, animate = true, fill = false }: { block: HomepageBlock; index?: number; animate?: boolean; fill?: boolean }) {
  const { v, h, text, scrim } = alignment(block.textAlign);
  const { ref, shown } = useReveal(animate);

  const style = {
    ['--col-span' as any]: String(Math.min(Math.max(block.columnSpan, 1), 12)),
    ['--aspect' as any]: aspect(block.aspectRatio),
    ['--overlay' as any]: String(Math.min(Math.max(block.overlayOpacity, 0), 100) / 100),
    ['--text-color' as any]: block.textColor || '#ffffff',
    ['--v-align' as any]: v,
    ['--h-align' as any]: h,
    ['--text-align' as any]: text,
    ['--scrim-dir' as any]: scrim,
    ['--reveal-delay' as any]: `${Math.min(index, 8) * 90}ms`,
    ['--bg' as any]: block.kind === 'color' ? block.backgroundColor || '#0b1220' : '#0b1220',
  } as React.CSSProperties;

  const classes = [
    styles.block,
    fill ? styles.fill : '',
    shown ? styles.revealed : '',
    block.hideOnMobile ? styles.hideMobile : '',
  ]
    .filter(Boolean)
    .join(' ');
  const isMedia = block.kind === 'image' || block.kind === 'video';
  const hasText = block.heading || block.subheading || block.ctaLabel;

  return (
    <div ref={ref} className={classes} style={style}>
      {block.kind === 'video' && block.videoUrl ? (
        <video className={styles.media} autoPlay muted loop playsInline poster={block.imageUrl ?? undefined}>
          <source src={block.videoUrl} />
        </video>
      ) : block.kind === 'image' && block.imageUrl ? (
        <img className={styles.media} src={block.imageUrl} alt={block.heading ?? ''} loading="lazy" />
      ) : null}

      {isMedia && block.overlayOpacity > 0 && <div className={styles.overlay} />}
      {isMedia && hasText && <div className={styles.scrim} />}

      {hasText && (
        <div className={styles.content}>
          {block.heading && <h3 className={styles.heading}>{block.heading}</h3>}
          {block.subheading && <p className={styles.subheading}>{block.subheading}</p>}
          {block.ctaLabel && (
            <span className={styles.cta}>
              {block.ctaLabel} <ArrowRight className={`${styles.ctaArrow} w-3.5 h-3.5`} />
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
      {blocks.map((b, i) => (
        <PromoBlock key={b.id} block={b} index={i} />
      ))}
    </div>
  );
}
