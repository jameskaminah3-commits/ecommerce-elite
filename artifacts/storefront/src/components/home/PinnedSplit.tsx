import React from 'react';
import { PromoBlock, type HomepageBlock } from './PromoBlock';
import styles from './PinnedSplit.module.css';

// Normalize "16/9" or "16 / 9" into a valid CSS aspect-ratio value.
function aspect(value: string): string {
  const cleaned = (value || '4/5').replace(/\s+/g, '');
  const [w, h] = cleaned.split('/');
  return w && h ? `${w} / ${h}` : '4 / 5';
}

// A sticky split section: the first block pins to the viewport while the rest
// scroll past it as a gallery. Uses CSS `position: sticky` rather than
// scroll-jacking, so normal scrolling, keyboard and screen-reader flow are all
// preserved. On mobile everything simply stacks in order.
export function PinnedSplit({ blocks }: { blocks: HomepageBlock[] }) {
  if (!blocks || blocks.length === 0) return null;

  // A single block has nothing to scroll past — render it on its own.
  if (blocks.length === 1) {
    const only = blocks[0];
    return (
      <div className={styles.solo} style={{ aspectRatio: aspect(only.aspectRatio) }}>
        <PromoBlock block={only} fill />
      </div>
    );
  }

  const [pinned, ...rest] = blocks;
  return (
    <section className={styles.wrap} aria-label={pinned.heading ?? 'Featured'}>
      <div className={styles.pinCol}>
        <div className={styles.pinSticky}>
          <PromoBlock block={pinned} fill animate={false} />
        </div>
      </div>
      <div className={styles.scrollCol}>
        {rest.map((b, i) => (
          <PromoBlock key={b.id} block={b} fill={false} index={i} />
        ))}
      </div>
    </section>
  );
}
