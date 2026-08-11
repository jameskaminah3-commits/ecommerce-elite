import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { HomepageBlock } from './PromoBlock';
import styles from './SplitHero.module.css';

// A calm two-column hero: the headline + CTA sit in a soft pastel panel beside a
// clean lifestyle image. Multiple hero blocks rotate with a gentle cross-fade
// (image and copy together). One block renders as a static split.
const ROTATE_MS = 6500;

// Cycle the panel tints so successive slides feel intentional, not random.
const PANEL_TINTS = [styles.tintBlush, styles.tintSage, styles.tintSand, styles.tintMist];

// Split a heading so the last word can take an italic-serif accent.
function splitHeading(heading: string | null): { lead: string; accent: string } {
  const text = (heading ?? '').trim();
  if (!text) return { lead: '', accent: '' };
  const parts = text.split(' ');
  if (parts.length === 1) return { lead: '', accent: text };
  return { lead: parts.slice(0, -1).join(' '), accent: parts[parts.length - 1] };
}

export function SplitHero({ blocks }: { blocks: HomepageBlock[] }) {
  const slides = blocks.filter(Boolean);
  const [active, setActive] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (slides.length <= 1) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (!paused.current) setActive((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const current = slides[active % slides.length];
  const { lead, accent } = splitHeading(current.heading);
  const tint = PANEL_TINTS[active % PANEL_TINTS.length];
  const isVideo = current.kind === 'video' && current.videoUrl;

  return (
    <div
      className={styles.hero}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      {/* Only the active slide is rendered — keyed so each change fades in
          cleanly, with no text-on-text overlap between slides. */}
      <div key={current.id} className={styles.slide}>
        {/* Copy panel */}
        <div className={`${styles.panel} ${tint}`}>
          <div className={styles.panelInner}>
            {current.subheading && <p className={styles.eyebrow}>{current.subheading}</p>}
            {current.heading && (
              <h1 className={styles.heading}>
                {lead && <span>{lead} </span>}
                <span className="serif-accent">{accent}</span>
              </h1>
            )}
            {current.ctaLabel && (
              <Link href={current.ctaHref || '/products'} className={styles.cta}>
                {current.ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>

        {/* Image / video side */}
        <div className={styles.media}>
          {isVideo ? (
            <video autoPlay muted loop playsInline poster={current.imageUrl ?? undefined}>
              <source src={current.videoUrl!} />
            </video>
          ) : current.imageUrl ? (
            <img src={current.imageUrl} alt={current.heading ?? ''} />
          ) : null}
        </div>
      </div>

      {/* Slide progress ticks (thin, minimal) */}
      {slides.length > 1 && (
        <div className={styles.ticks}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={`${styles.tick} ${i === active ? styles.tickActive : ''}`}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
