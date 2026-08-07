import React, { useEffect, useRef, useState } from 'react';
import { PromoBlock, type HomepageBlock } from './PromoBlock';
import styles from './PromoBlock.module.css';

function aspect(value: string): string {
  const cleaned = (value || '21/9').replace(/\s+/g, '');
  const [w, h] = cleaned.split('/');
  return w && h ? `${w} / ${h}` : '21 / 9';
}

const ROTATE_MS = 6000;

// Auto-rotating hero: cross-fades between full-bleed slides. No dots — ambient
// motion only. Pauses on hover, and holds on the first slide when the viewer
// prefers reduced motion.
export function HeroSlideshow({ blocks }: { blocks: HomepageBlock[] }) {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);

  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (blocks.length <= 1 || reduced) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) setActive((i) => (i + 1) % blocks.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [blocks.length, reduced]);

  if (blocks.length === 0) return null;

  const heroAspect = aspect(blocks[0].aspectRatio);

  return (
    <div
      className={styles.hero}
      style={{ ['--hero-aspect' as any]: heroAspect } as React.CSSProperties}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
    >
      {blocks.map((b, i) => (
        <div key={b.id} className={`${styles.slide} ${i === active ? styles.slideActive : ''}`} aria-hidden={i !== active}>
          <PromoBlock block={b} animate={false} fill />
        </div>
      ))}
    </div>
  );
}
