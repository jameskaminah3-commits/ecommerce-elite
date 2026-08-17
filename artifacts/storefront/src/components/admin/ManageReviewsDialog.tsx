import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface ReviewItem {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  userName: string;
  createdAt: string;
}

async function fetchReviews(productId: number): Promise<{ items: ReviewItem[]; average: number; count: number }> {
  const res = await fetch(`${API_BASE}/api/products/${productId}/reviews`, { credentials: 'include' });
  if (!res.ok) return { items: [], average: 0, count: 0 };
  return res.json();
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(s)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${s} star${s > 1 ? 's' : ''}`}
        >
          <Star className={`w-5 h-5 ${s <= value ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`} />
        </button>
      ))}
    </div>
  );
}

export function ManageReviewsDialog({
  productId,
  productName,
  open,
  onOpenChange,
}: {
  productId: number | null;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-reviews', productId],
    queryFn: () => fetchReviews(productId ?? 0),
    enabled: open && productId != null,
  });

  const [authorName, setAuthorName] = useState('');
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-reviews', productId] });
    queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'admin' && q.queryKey[1] === 'products' });
  };

  const addReview = async () => {
    if (productId == null) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ authorName: authorName.trim(), rating, title: title.trim(), body: body.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      toast({ title: 'Review added' });
      setAuthorName(''); setRating(5); setTitle(''); setBody('');
      reload();
    } catch {
      toast({ title: 'Failed to add review', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const deleteReview = async (id: number) => {
    if (!confirm('Delete this review?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/reviews/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok && res.status !== 204) throw new Error('Failed');
      toast({ title: 'Review deleted' });
      reload();
    } catch {
      toast({ title: 'Failed to delete review', variant: 'destructive' });
    }
  };

  const items = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Reviews — {productName}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">
          Customers can rate a product after buying it. Here you can add reviews yourself and remove any that break the rules.
          {data ? <> Current: <span className="font-medium text-foreground">{data.average.toFixed(1)}★ ({data.count})</span></> : null}
        </p>

        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          {/* Existing reviews */}
          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-sm border border-dashed rounded-lg">No reviews yet.</div>
            ) : (
              items.map((r) => (
                <div key={r.id} className="flex items-start gap-3 border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Stars value={r.rating} />
                      <span className="font-semibold text-sm">{r.userName}</span>
                    </div>
                    {r.title && <p className="font-medium text-sm">{r.title}</p>}
                    {r.body && <p className="text-sm text-muted-foreground line-clamp-3">{r.body}</p>}
                  </div>
                  <button
                    className="text-muted-foreground hover:text-destructive p-1.5 shrink-0"
                    onClick={() => deleteReview(r.id)}
                    aria-label="Delete review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add review */}
          <div className="border-t pt-4 space-y-3">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Add a review</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rev-author" className="text-xs">Reviewer name</Label>
                <Input id="rev-author" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="e.g. Wanjiku M." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rating</Label>
                <Stars value={rating} onChange={setRating} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-title" className="text-xs">Title (optional)</Label>
              <Input id="rev-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Great quality" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-body" className="text-xs">Review (optional)</Label>
              <Textarea id="rev-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
            </div>
            <Button onClick={addReview} disabled={busy} className="font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> {busy ? 'Adding…' : 'Add review'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
