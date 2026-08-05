import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getGetProductQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Star, Lock, CheckCircle2 } from 'lucide-react';
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
    <div className="border-t pt-8 mt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg">Customer Reviews</h3>
        {data && data.count > 0 && (
          <div className="flex items-center gap-2">
            <Stars value={data.average} />
            <span className="text-sm text-muted-foreground">{data.average.toFixed(1)} · {data.count} review{data.count === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>

      {/* Write-a-review area */}
      {canWrite ? (
        <form onSubmit={submit} className="bg-muted/30 border rounded-xl p-5 mb-8 space-y-4">
          <p className="font-semibold text-sm">Write your review</p>
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
              <p className="text-xs text-muted-foreground mt-2">— {r.userName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
