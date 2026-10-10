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
import { MediaPicker } from '@/components/media/MediaPicker';
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
          <DialogTitle>Stock, variants &amp; pricing — {productName}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Each variant is a buyable option (e.g. a size or colour).
          <span className="text-foreground font-medium"> Price</span> is what the customer pays;
          <span className="text-foreground font-medium"> Stock</span> is how many you have;
          <span className="text-foreground font-medium"> SKU</span> is your own unique code.
          Give each colour its own <span className="text-foreground font-medium">photo</span> — the storefront swaps to it when the shopper picks that colour.
        </p>

        <div className="overflow-y-auto -mx-1 px-1 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading variants…</div>
          ) : !variants || variants.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm border border-dashed rounded-lg">
              No options yet. Add one below with its price and stock — the product appears in the shop once it has a price.
              <span className="block mt-1">No sizes or colours? Just add one option with the price and stock.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {(variants as ProductVariant[]).map((v) => (
                <VariantRow key={v.id} variant={v} onChanged={invalidate} />
              ))}
            </div>
          )}

          {productId != null && (
            <AddVariantForm productId={productId} productName={productName} onAdded={invalidate} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// A variant needs a real selling price: a blank box must never be saved as KES 0
// (that hides the whole product from the shop).
function parseVariantNumbers(price: string, stock: string): { priceNum: number; stockNum: number } | string {
  const priceNum = Number(price);
  const stockNum = Number(stock);
  if (price.trim() === '' || !Number.isFinite(priceNum) || priceNum <= 0) return 'Enter a selling price above KES 0.';
  if (stock.trim() === '' || !Number.isInteger(stockNum) || stockNum < 0) return 'Enter the stock you have (0 or more).';
  return { priceNum, stockNum };
}

const GRID = 'grid grid-cols-2 sm:grid-cols-[1fr_80px_80px_96px_76px_auto] gap-2 items-end';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block sm:hidden text-[11px] font-bold uppercase text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
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
  const [imageUrl, setImageUrl] = useState(variant.imageUrl ?? '');

  const dirty =
    sku !== variant.sku ||
    size !== (variant.size ?? '') ||
    color !== (variant.color ?? '') ||
    price !== String(variant.price) ||
    stock !== String(variant.stock) ||
    imageUrl !== (variant.imageUrl ?? '');

  const save = async () => {
    const parsed = parseVariantNumbers(price, stock);
    if (!sku.trim() || typeof parsed === 'string') {
      toast({ title: !sku.trim() ? 'Enter a SKU.' : parsed as string, variant: 'destructive' });
      return;
    }
    const { priceNum, stockNum } = parsed;
    try {
      await updateMutation.mutateAsync({
        id: variant.id,
        data: {
          sku: sku.trim(),
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          price: priceNum,
          stock: stockNum,
          imageUrl: imageUrl.trim() || undefined,
        },
      });
      toast({ title: 'Variant updated' });
      onChanged();
    } catch (err: any) {
      toast({ title: 'Failed to update variant', description: err?.data?.error, variant: 'destructive' });
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

  const unpriced = !(variant.price > 0);
  return (
    <div className={`border rounded-lg p-3 space-y-3 ${unpriced ? 'border-amber-300 bg-amber-50/50' : ''}`}>
      {unpriced && (
        <p className="text-xs font-semibold text-amber-800">
          No selling price — customers can't see or buy this option. Enter a price and save.
        </p>
      )}
      <div className="hidden sm:grid grid-cols-[1fr_80px_80px_96px_76px_auto] gap-2 px-0.5 text-[11px] font-bold uppercase text-muted-foreground">
        <span>SKU</span><span>Size</span><span>Color</span><span>Price (KES)</span><span>Stock</span><span></span>
      </div>
      <div className={GRID}>
        <Field label="SKU" className="col-span-2 sm:col-span-1"><Input className="h-9" value={sku} onChange={(e) => setSku(e.target.value)} /></Field>
        <Field label="Size"><Input className="h-9" value={size} onChange={(e) => setSize(e.target.value)} placeholder="—" /></Field>
        <Field label="Color"><Input className="h-9" value={color} onChange={(e) => setColor(e.target.value)} placeholder="—" /></Field>
        <Field label="Price (KES)"><Input className={`h-9 ${unpriced ? 'border-amber-400' : ''}`} type="number" inputMode="numeric" min="1" step="1" value={unpriced && price === '0' ? '' : price} placeholder="Price" onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Stock"><Input className="h-9" type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} /></Field>
        <div className="flex gap-1 col-span-2 sm:col-span-1 justify-end">
          <Button size="icon" variant={dirty ? 'default' : 'outline'} className="h-9 w-9" onClick={save} disabled={busy || !dirty} title="Save">
            <Save className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" onClick={remove} disabled={busy} title="Delete">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <MediaPicker value={imageUrl} onChange={setImageUrl} label={`Photo for ${color || 'this variant'}`} />
    </div>
  );
}

function suggestSku(productName: string): string {
  const base = productName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 12) || 'SKU';
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function AddVariantForm({ productId, productName, onAdded }: { productId: number; productName: string; onAdded: () => void }) {
  const { toast } = useToast();
  const createMutation = useCreateProductVariant();
  const [sku, setSku] = useState(() => suggestSku(productName));
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const add = async () => {
    const parsed = parseVariantNumbers(price, stock);
    if (!sku.trim() || typeof parsed === 'string') {
      toast({ title: !sku.trim() ? 'Enter a SKU.' : parsed as string, variant: 'destructive' });
      return;
    }
    const { priceNum, stockNum } = parsed;
    try {
      await createMutation.mutateAsync({
        id: productId,
        data: {
          sku: sku.trim(),
          size: size.trim() || undefined,
          color: color.trim() || undefined,
          price: priceNum,
          stock: stockNum,
          imageUrl: imageUrl.trim() || undefined,
        },
      });
      toast({ title: 'Variant added' });
      setSku(suggestSku(productName)); setSize(''); setColor(''); setPrice(''); setStock(''); setImageUrl('');
      onAdded();
    } catch (err: any) {
      toast({ title: 'Failed to add variant', description: err?.data?.error || 'Please check the details and try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="border-t pt-4 mt-2 space-y-3">
      <Label className="text-xs font-bold uppercase text-muted-foreground">Add variant</Label>
      <div className={GRID}>
        <Field label="SKU" className="col-span-2 sm:col-span-1"><Input className="h-9" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" /></Field>
        <Field label="Size (optional)"><Input className="h-9" value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" /></Field>
        <Field label="Color (optional)"><Input className="h-9" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color" /></Field>
        <Field label="Price (KES) *"><Input aria-label="Price" className="h-9" type="number" inputMode="numeric" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" /></Field>
        <Field label="Stock *"><Input aria-label="Stock" className="h-9" type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" /></Field>
        <Button className="h-9 col-span-2 sm:col-span-1 sm:w-9 sm:px-0" onClick={add} disabled={createMutation.isPending} title="Add variant">
          <Plus className="w-4 h-4" /><span className="sm:hidden ml-1.5">Add variant</span>
        </Button>
      </div>
      <MediaPicker value={imageUrl} onChange={setImageUrl} label="Variant photo (optional)" />
    </div>
  );
}
