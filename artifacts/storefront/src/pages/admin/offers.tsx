import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  useListProducts,
  useUpdateProduct,
  getListProductsQueryKey,
} from '@workspace/api-client-react';
import { formatCurrency, applyDiscount, clampPercent } from '@/lib/utils';
import { Tag, Search, Percent, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';

type ProductRow = {
  id: number;
  name: string;
  imageUrl?: string | null;
  categoryName?: string | null;
  basePrice: number;
  discountPercent?: number | null;
};

export default function AdminOffers() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'onOffer'>('all');
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const { data: productsData, isLoading } = useListProducts(
    { search: search || undefined, limit: 100 },
    { query: { queryKey: ['admin', 'offers', search] } as any },
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMutation = useUpdateProduct();

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'admin' && q.queryKey[1] === 'offers',
    });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  };

  const products = (productsData?.items ?? []) as ProductRow[];
  const onOffer = (p: ProductRow) => clampPercent(p.discountPercent) > 0;
  const rows = filter === 'onOffer' ? products.filter(onOffer) : products;
  const onOfferCount = products.filter(onOffer).length;

  const endOffer = async (p: ProductRow) => {
    if (!confirm(`End the ${clampPercent(p.discountPercent)}% offer on "${p.name}"?`)) return;
    try {
      await updateMutation.mutateAsync({ id: p.id, data: { discountPercent: 0 } });
      invalidate();
      toast({ title: 'Offer ended' });
    } catch (e) {
      toast({ title: 'Failed to end offer', variant: 'destructive' });
    }
  };

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Offers</h1>
            <p className="text-muted-foreground mt-1">Run sales and markdowns across your catalogue — applied at checkout.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-destructive/10 text-destructive font-bold">
              {onOfferCount} live {onOfferCount === 1 ? 'offer' : 'offers'}
            </span>
          </div>
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-muted/10 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex rounded-lg border bg-background p-0.5 text-sm">
              <button
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setFilter('all')}
              >
                All products
              </button>
              <button
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filter === 'onOffer' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => setFilter('onOffer')}
              >
                On offer
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold">Product</th>
                  <th className="px-6 py-4 font-bold">List price</th>
                  <th className="px-6 py-4 font-bold">Offer</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center">Loading products...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                    {filter === 'onOffer' ? 'No live offers. Set one from the All products tab.' : 'No products found.'}
                  </td></tr>
                ) : (
                  rows.map((p) => {
                    const pct = clampPercent(p.discountPercent);
                    const live = pct > 0;
                    return (
                      <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                              {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-muted-foreground/30" />}
                            </div>
                            <div>
                              <div className="font-medium text-foreground line-clamp-1">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.categoryName || 'General'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {live ? (
                            <div>
                              <span className="text-xs text-muted-foreground line-through mr-2">{formatCurrency(p.basePrice)}</span>
                              <span className="font-bold text-destructive">{formatCurrency(applyDiscount(p.basePrice, pct))}</span>
                            </div>
                          ) : (
                            <span className="font-bold">{formatCurrency(p.basePrice)}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {live ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive">
                              <Percent className="w-3 h-3" /> {pct}% off
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                              <Tag className="w-3.5 h-3.5 mr-1.5" /> {live ? 'Edit offer' : 'Set offer'}
                            </Button>
                            {live && (
                              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => endOffer(p)}>
                                End
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <OfferDialog
          key={editing?.id ?? 'none'}
          product={editing}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={invalidate}
        />
      </AdminLayout>
    </AuthGuard>
  );
}

function OfferDialog({
  product,
  onOpenChange,
  onSaved,
}: {
  product: ProductRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateProduct();

  const [percent, setPercent] = useState(
    product ? String(clampPercent(product.discountPercent) || '') : '',
  );

  const parsed = clampPercent(Number(percent));
  const list = product?.basePrice ?? 0;
  const preview = useMemo(() => {
    if (!percent || parsed <= 0) return null;
    const sale = applyDiscount(list, parsed);
    return { sale, saved: Math.round((list - sale) * 100) / 100 };
  }, [percent, parsed, list]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const pct = clampPercent(Number(percent));
    if (pct <= 0) {
      toast({ title: 'Enter a discount between 1 and 90%.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: product.id, data: { discountPercent: pct } });
      toast({ title: `Offer applied — ${pct}% off` });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: 'Failed to apply offer', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={product != null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{product && clampPercent(product.discountPercent) > 0 ? 'Edit offer' : 'Set offer'}</DialogTitle>
        </DialogHeader>
        {product && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-medium line-clamp-1">{product.name}</p>
              <p className="text-sm text-muted-foreground">List price {formatCurrency(list)}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="percent">Discount percentage</Label>
              <div className="relative">
                <Input
                  id="percent"
                  type="number"
                  min="1"
                  max="90"
                  step="1"
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  className="pr-8"
                  autoFocus
                  required
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex gap-2 pt-1">
                {[10, 20, 30, 50].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercent(String(pct))}
                    className="px-2.5 py-1 rounded-md border text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              {preview && (
                <p className="text-sm text-destructive font-medium pt-1">
                  New price {formatCurrency(preview.sale)} — shoppers save {formatCurrency(preview.saved)} per unit
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Apply Offer'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
