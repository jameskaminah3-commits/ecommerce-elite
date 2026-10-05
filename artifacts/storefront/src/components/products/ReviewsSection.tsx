import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGetProductQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Star, Lock, CheckCircle2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { classNames } from '@/lib/utils';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface ReviewItem {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  userName: string;
  verified?: boolean;
  createdAt: string;
}
interface ReviewsResponse {
  items: ReviewItem[];
  average: number;
  count: number;
  viewer: { authenticated: boolean; purchased: boolean; hasReviewed: boolean };
}

async function fetchReviews(productId: number): Promise<ReviewsResponse> {
  const res = await fetch(`${API_BASE}/api/products/${productId}/reviews`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load reviews');
  return res.json();
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <div className={classNames('flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={classNames(
            'w-4 h-4',
            s <= Math.round(value) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30 fill-muted-foreground/10',
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsSection({ productId }: { productId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId),
  });

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Deep links like /products/6#reviews (from the order page) land here.
  React.useEffect(() => {
    if (!data || window.location.hash !== '#reviews') return;
    const t = setTimeout(() => document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [data]);

  const viewer = data?.viewer;
  const canWrite = viewer?.authenticated && viewer?.purchased && !viewer?.hasReviewed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      toast({ title: 'Please select a star rating.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${productId}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, title: title.trim() || undefined, body: body.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit review');
      }
      toast({ title: 'Thanks for your review!' });
      setRating(0); setTitle(''); setBody('');
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to submit review', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="reviews" className="border-t pt-8 mt-8 scroll-mt-24">
      <h3 className="font-bold text-lg mb-5">Customer Reviews</h3>

      {/* Summary: big average + how the ratings are distributed */}
      {data && data.count > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8 mb-7 p-5 rounded-xl bg-muted/30 border">
          <div className="text-center sm:text-left shrink-0">
            <p className="text-5xl font-semibold tracking-tight leading-none">{data.average.toFixed(1)}</p>
            <Stars value={data.average} className="mt-2.5 justify-center sm:justify-start" />
            <p className="text-xs text-muted-foreground mt-1.5">{data.count} review{data.count === 1 ? '' : 's'}</p>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = data.items.filter((r) => Math.round(r.rating) === star).length;
              const pct = data.items.length ? (n / data.items.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2.5 text-xs">
                  <span className="w-3 text-muted-foreground tabular-nums">{star}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-border/70 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-muted-foreground tabular-nums">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Write-a-review area */}
      {canWrite ? (
        <form onSubmit={submit} className="bg-muted/30 border rounded-xl p-5 mb-8 space-y-4">
          <p className="font-semibold text-sm">How was it? Rate this product</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                className="p-0.5"
                aria-label={`${s} star${s === 1 ? '' : 's'}`}
              >
                <Star
                  className={classNames(
                    'w-6 h-6 transition-colors',
                    s <= (hover || rating) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30 fill-muted-foreground/10',
                  )}
                />
              </button>
            ))}
          </div>
          <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <Textarea placeholder="Share your experience (optional)" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
          <p className="text-xs text-muted-foreground">
            {rating ? ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][rating] : 'Tap a star to rate'}
          </p>
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit Review'}</Button>
        </form>
      ) : (
        !isLoading && (
          <div className="bg-muted/30 border rounded-xl p-4 mb-8 flex items-center gap-3 text-sm">
            {!viewer?.authenticated ? (
              <>
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  <Link href="/account" className="text-primary font-medium hover:underline">Sign in</Link> to leave a review.
                </span>
              </>
            ) : viewer?.hasReviewed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-muted-foreground">You've reviewed this product. Thank you!</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Only verified buyers can review this product.</span>
              </>
            )}
          </div>
        )
      )}

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reviews…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review this product.</p>
      ) : (
        <div className="space-y-5">
          {data.items.map((r) => (
            <div key={r.id} className="border-b pb-5 last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <Stars value={r.rating} />
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              {r.title && <p className="font-semibold text-sm">{r.title}</p>}
              {r.body && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{r.body}</p>}
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                — {r.userName}
                {r.verified && (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                    <BadgeCheck className="w-3.5 h-3.5" /> Verified buyer
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
