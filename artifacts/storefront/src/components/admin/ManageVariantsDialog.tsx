import React, { useState } from 'react';
import {
  useListProductVariants,
  useCreateProductVariant,
  useUpdateVariant,
  useDeleteVariant,
  getListProductVariantsQueryKey,
  getListProductsQueryKey,
  type ProductVariant,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export function ManageVariantsDialog({
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
  const { data: variants, isLoading } = useListProductVariants(productId ?? 0, {
    query: { enabled: open && productId != null } as any,
  });
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (productId != null) {
      queryClient.invalidateQueries({ queryKey: getListProductVariantsQueryKey(productId) });
    }
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    queryClient.invalidateQueries({
      predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'admin' && q.queryKey[1] === 'products',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Stock &amp; Variants — {productName}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto -mx-1 px-1 space-y-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading variants…</div>
          ) : !variants || variants.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              No variants yet. Add one below — a product needs at least one variant to be purchasable.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_80px_90px_70px_auto] gap-2 px-1 text-[11px] font-bold uppercase text-muted-foreground">
                <span>SKU</span><span>Size</span><span>Color</span><span>Price</span><span>Stock</span><span></span>
              </div>
              {(variants as ProductVariant[]).map((v) => (
                <VariantRow key={v.id} variant={v} onChanged={invalidate} />
              ))}
            </div>
          )}

          {productId != null && (
            <AddVariantForm productId={productId} onAdded={invalidate} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VariantRow({ variant, onChanged }: { variant: ProductVariant; onChanged: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateVariant();
  const deleteMutation = useDeleteVariant();

  const [sku, setSku] = useState(variant.sku);
  const [size, setSize] = useState(variant.size ?? '');
  const [color, setColor] = useState(variant.color ?? '');
  const [price, setPrice] = useState(String(variant.price));
  const [stock, setStock] = useState(String(variant.stock));

  const dirty =
    sku !== variant.sku ||
    size !== (variant.size ?? '') ||
    color !== (variant.color ?? '') ||
    price !== String(variant.price) ||
    stock !== String(variant.stock);

  const save = async () => {
    const priceNum = Number(price);
    const stockNum = parseInt(stock, 10);
    if (!sku.trim() || Number.isNaN(priceNum) || Number.isNaN(stockNum)) {
      toast({ title: 'SKU, a valid price and stock are required.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: variant.id,
        data: { sku: sku.trim(), size: size.trim() || undefined, color: color.trim() || undefined, price: priceNum, stock: stockNum },
      });
      toast({ title: 'Variant updated' });
      onChanged();
    } catch {
      toast({ title: 'Failed to update variant', variant: 'destructive' });
    }
  };

  const remove = async () => {
    if (!confirm(`Delete variant ${variant.sku}?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: variant.id });
      toast({ title: 'Variant deleted' });
      onChanged();
    } catch {
      toast({ title: 'Failed to delete variant', variant: 'destructive' });
    }
  };

  const busy = updateMutation.isPending || deleteMutation.isPending;

  return (
    <div className="grid grid-cols-[1fr_80px_80px_90px_70px_auto] gap-2 items-center">
      <Input className="h-9" value={sku} onChange={(e) => setSku(e.target.value)} />
      <Input className="h-9" value={size} onChange={(e) => setSize(e.target.value)} placeholder="—" />
      <Input className="h-9" value={color} onChange={(e) => setColor(e.target.value)} placeholder="—" />
      <Input className="h-9" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Input className="h-9" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
      <div className="flex gap-1">
        <Button size="icon" variant={dirty ? 'default' : 'outline'} className="h-9 w-9" onClick={save} disabled={busy || !dirty} title="Save">
          <Save className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={remove} disabled={busy} title="Delete">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function AddVariantForm({ productId, onAdded }: { productId: number; onAdded: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateProductVariant();
  const [sku, setSku] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');

  const add = async () => {
    const priceNum = Number(price);
    const stockNum = parseInt(stock, 10);
    if (!sku.trim() || Number.isNaN(priceNum) || Number.isNaN(stockNum)) {
      toast({ title: 'SKU, price and stock are required.', variant: 'destructive' });
      return;
    }
    try {
      await createMutation.mutateAsync({
        id: productId,
        data: { sku: sku.trim(), size: size.trim() || undefined, color: color.trim() || undefined, price: priceNum, stock: stockNum },
      });
      toast({ title: 'Variant added' });
      setSku(''); setSize(''); setColor(''); setPrice(''); setStock('');
      onAdded();
    } catch (err) {
      toast({ title: 'Failed to add variant (is the SKU unique?)', variant: 'destructive' });
    }
  };

  return (
    <div className="border-t pt-4 mt-2">
      <Label className="text-xs font-bold uppercase text-muted-foreground">Add variant</Label>
      <div className="grid grid-cols-[1fr_80px_80px_90px_70px_auto] gap-2 items-center mt-2">
        <Input className="h-9" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
        <Input className="h-9" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" />
        <Input className="h-9" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color" />
        <Input className="h-9" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
        <Input className="h-9" type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" />
        <Button size="icon" className="h-9 w-9" onClick={add} disabled={createMutation.isPending} title="Add">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
