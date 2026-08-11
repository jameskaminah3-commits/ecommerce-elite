import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import styles from './PromoBlock.module.css';

export interface HomepageBlock {
  id: number;
  placement?: 'hero' | 'grid' | 'pinned';
  kind: 'image' | 'color' | 'video';
  imageUrl: string | null;
  videoUrl: string | null;
  backgroundColor: string | null;
  overlayOpacity: number;
  columnSpan: number;
  rowSpan?: number;
  hideOnMobile: boolean;
  parallax?: boolean;
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

// Numeric aspect (width / height) for deriving a row span.
function aspectValue(value: string): number {
  const cleaned = (value || '16/9').replace(/\s+/g, '');
  const [w, h] = cleaned.split('/').map(Number);
  return w && h ? w / h : 16 / 9;
}

// How many grid rows a block occupies on desktop. An explicit rowSpan (> 0)
// enables bento layouts (a tall tile beside stacked ones); otherwise the span
// is derived from the column span and aspect ratio so the block keeps roughly
// its intended proportions. Row unit ≈ one column width, so rows ≈ cols / aspect.
function rowSpanFor(block: HomepageBlock): number {
  if (block.rowSpan && block.rowSpan > 0) return Math.min(block.rowSpan, 12);
  const derived = Math.round(block.columnSpan / aspectValue(block.aspectRatio));
  return Math.min(Math.max(derived, 1), 12);
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

// Parallax: drift the media slower than the page while the block is in view.
// Gated by an IntersectionObserver so the scroll work only runs on-screen, and
// disabled under prefers-reduced-motion. The offset is written to a CSS custom
// property (--parallax-y) so the compositor handles the transform.
function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const media = el.querySelector<HTMLElement>('[data-parallax-media]');
    if (!media) return;

    const STRENGTH = 0.14; // fraction of block height the media travels
    let raf = 0;
    let visible = false;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // -1 (block below viewport) … 0 (centered) … +1 (above); centered = no shift.
      const progress = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      const shift = -progress * rect.height * STRENGTH;
      media.style.setProperty('--parallax-y', `${shift.toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!visible || raf) return;
      raf = window.requestAnimationFrame(update);
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) update();
    });
    io.observe(el);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return ref;
}

export function PromoBlock({ block, index = 0, animate = true, fill = false }: { block: HomepageBlock; index?: number; animate?: boolean; fill?: boolean }) {
  const { v, h, text, scrim } = alignment(block.textAlign);
  const { ref, shown } = useReveal(animate);
  const isMediaBlock = block.kind === 'image' || block.kind === 'video';
  const parallaxOn = !!block.parallax && isMediaBlock;
  const parallaxRef = useParallax(parallaxOn);
  const setRefs = (node: HTMLDivElement | null) => {
    ref.current = node;
    parallaxRef.current = node;
  };

  const style = {
    ['--col-span' as any]: String(Math.min(Math.max(block.columnSpan, 1), 12)),
    ['--row-span' as any]: String(rowSpanFor(block)),
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
    parallaxOn ? styles.parallax : '',
  ]
    .filter(Boolean)
    .join(' ');
  const isMedia = isMediaBlock;
  const hasText = block.heading || block.subheading || block.ctaLabel;
  const mediaClass = `${styles.media}${parallaxOn ? ` ${styles.mediaParallax}` : ''}`;

  return (
    <div ref={setRefs} className={classes} style={style}>
      {block.kind === 'video' && block.videoUrl ? (
        <video className={mediaClass} data-parallax-media autoPlay muted loop playsInline poster={block.imageUrl ?? undefined}>
          <source src={block.videoUrl} />
        </video>
      ) : block.kind === 'image' && block.imageUrl ? (
        <img className={mediaClass} data-parallax-media src={block.imageUrl} alt={block.heading ?? ''} loading="lazy" />
      ) : null}

      {/* Solid-colour "discount tile": a product image floats on the pastel
          background while the copy sits alongside it (Expanse-style promo). */}
      {block.kind === 'color' && block.imageUrl && (
        <img className={styles.foreground} src={block.imageUrl} alt="" loading="lazy" />
      )}

      {isMedia && block.overlayOpacity > 0 && <div className={styles.overlay} />}
      {/* Universal legibility gradient over every media asset (stronger when the
          block carries text, subtle otherwise) so overlaid copy stays readable
          regardless of image contrast. */}
      {isMedia && <div className={`${styles.scrim} ${hasText ? styles.scrimText : ''}`} />}

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
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Keep the grid's row unit equal to one column's width so bento tiles (blocks
  // that span multiple rows) align exactly with the column rhythm and with each
  // other, gaps included. Recomputed on every resize.
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 0;
      const unit = (el.clientWidth - gap * 11) / 12;
      if (unit > 0) el.style.setProperty('--row-unit', `${unit}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [blocks]);

  if (!blocks || blocks.length === 0) return null;
  return (
    <div ref={gridRef} className={styles.grid}>
      {blocks.map((b, i) => (
        <PromoBlock key={b.id} block={b} index={i} />
      ))}
    </div>
  );
}
