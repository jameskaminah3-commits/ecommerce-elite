import React from 'react';
import { Check } from 'lucide-react';

// Turns a product description typed (or pasted) as plain text into a clean,
// premium layout — without changing a word of it, so SEO is untouched:
//   • the opening sentences become the lead paragraph
//   • "Key Features:", "What's Included:", "Specifications:" … become headings
//   • "•", "-", "*" or "✓" items (inline or on their own lines) become a list,
//     with a short "Label:" at the start of an item shown in bold.

const HEADINGS = [
  'key features', 'features', 'highlights', "what's included", 'what’s included', 'whats included',
  "what's in the box", 'what’s in the box', 'in the box', 'package includes', 'package contents',
  'specifications', 'specs', 'technical specifications', 'warranty', 'care instructions', 'how to use',
];
const HEADING_RE = new RegExp(
  `(^|[.!?)\\s])\\s*(${HEADINGS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*:`,
  'gi',
);

type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] };

export function parseDescription(raw: string): Block[] {
  let t = raw.replace(/\r/g, '');
  // "backup.Key Features:" → own heading line
  t = t.replace(HEADING_RE, (_m, pre: string, h: string) => `${pre.trim() ? pre : ''}\n\n§${h.trim()}\n`);
  // Inline bullets → one per line
  t = t.replace(/\s*[•●▪✓✔]\s*/g, '\n• ');
  const blocks: Block[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (list?.length) blocks.push({ kind: 'ul', items: list });
    list = null;
  };
  for (const line of t.split('\n').map((l) => l.trim())) {
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('§')) {
      flush();
      const h = line.slice(1).trim();
      blocks.push({ kind: 'h', text: h.charAt(0).toUpperCase() + h.slice(1) });
      continue;
    }
    const bullet = line.match(/^(?:•|-|\*|–)\s+(.*)$/);
    if (bullet) {
      (list ??= []).push(bullet[1]);
      continue;
    }
    flush();
    const prev = blocks[blocks.length - 1];
    if (prev?.kind === 'p' && !/[.!?:]$/.test(prev.text)) prev.text += ` ${line}`;
    else blocks.push({ kind: 'p', text: line });
  }
  flush();
  // Fix a missing space after a full stop ("backup.Key") in paragraphs.
  for (const b of blocks) if (b.kind === 'p') b.text = b.text.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  return blocks;
}

function Item({ text }: { text: string }) {
  const m = text.match(/^([^:]{2,32}):\s*(.+)$/);
  return (
    <li className="flex gap-3">
      <span className="mt-[3px] w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Check className="w-3 h-3" strokeWidth={3} />
      </span>
      <span>
        {m ? (
          <>
            <span className="font-semibold text-foreground">{m[1]}:</span> {m[2]}
          </>
        ) : (
          text
        )}
      </span>
    </li>
  );
}

export function ProductDescription({ text }: { text: string }) {
  const blocks = parseDescription(text);
  let firstP = true;
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-muted-foreground" data-testid="product-description">
      {blocks.map((b, i) => {
        if (b.kind === 'h') {
          return (
            <h4 key={i} className="pt-2 text-xs font-bold uppercase tracking-[0.14em] text-foreground">
              {b.text}
            </h4>
          );
        }
        if (b.kind === 'ul') {
          return (
            <ul key={i} className="space-y-2.5">
              {b.items.map((it, j) => (
                <Item key={j} text={it} />
              ))}
            </ul>
          );
        }
        const lead = firstP;
        firstP = false;
        return (
          <p key={i} className={lead ? 'text-[16px] text-foreground/85' : undefined}>
            {b.text}
          </p>
        );
      })}
    </div>
  );
}
