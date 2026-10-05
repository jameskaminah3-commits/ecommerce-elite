import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Share2, Copy, Check } from 'lucide-react';
import { SiWhatsapp, SiFacebook, SiX } from 'react-icons/si';

// Social share buttons. On mobile with Web Share API support we show a single
// native "Share" button (so WhatsApp/Instagram/etc. all appear in the OS sheet),
// plus explicit WhatsApp / Facebook / X / Copy for everyone — WhatsApp first,
// since it's the dominant sharing channel in Kenya.
export function ShareButtons({ url, title, className = '' }: { url: string; title: string; className?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;
  const shareText = `${title} — ${url}`;
  const canNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share;

  const native = async () => {
    try {
      await (navigator as any).share({ title, text: title, url });
    } catch {
      /* user cancelled */
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: 'Link copied' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  const btn = 'w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0';

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <span className="text-xs font-semibold text-muted-foreground mr-0.5">Share:</span>
      <a
        href={`https://wa.me/?text=${enc(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} border-transparent bg-[#25D366] text-white hover:opacity-90`}
        aria-label="Share on WhatsApp"
        title="WhatsApp"
      >
        <SiWhatsapp className="w-4 h-4" />
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} border-transparent bg-[#1877F2] text-white hover:opacity-90`}
        aria-label="Share on Facebook"
        title="Facebook"
      >
        <SiFacebook className="w-4 h-4" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btn} border-transparent bg-foreground text-background hover:opacity-90`}
        aria-label="Share on X"
        title="X (Twitter)"
      >
        <SiX className="w-4 h-4" />
      </a>
      <button type="button" onClick={copy} className={`${btn} border-border bg-background hover:bg-muted`} aria-label="Copy link" title="Copy link">
        {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
      </button>
      {canNativeShare && (
        <button type="button" onClick={native} className={`${btn} border-border bg-background hover:bg-muted`} aria-label="More share options" title="More">
          <Share2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
