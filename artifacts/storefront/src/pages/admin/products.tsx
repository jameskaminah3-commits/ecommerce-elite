import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  useListProducts,
  useDeleteProduct,
  useCreateProduct,
  useUpdateProduct,
  useListCategories,
  getListProductsQueryKey,
  type ProductInput,
} from '@workspace/api-client-react';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Image as ImageIcon, AlertTriangle, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MediaPicker } from '@/components/media/MediaPicker';
import { ManageVariantsDialog } from '@/components/admin/ManageVariantsDialog';
import { ManageReviewsDialog } from '@/components/admin/ManageReviewsDialog';
import { Boxes, Star } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDeliveryClasses } from '@/lib/deliveryApi';
import { productPath } from '@/lib/utils';
import {
  shopVisibility,
  seoChecklist,
  seoScore,
  autoSeoTitle,
  autoSeoDescription,
  previewUrl,
  TITLE_MAX,
  DESC_MAX,
  type Visibility,
} from '@/lib/productSeo';

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  categoryId: number;
  categoryName?: string | null;
  imageUrl?: string | null;
  images?: string[];
  status?: string;
  featured?: boolean;
  deliveryClassId?: number | null;
  totalStock?: number;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const TONE: Record<Visibility['tone'], string> = {
  ok: 'bg-emerald-100 text-emerald-700',
  warn: 'bg-amber-100 text-amber-800',
  off: 'bg-muted text-muted-foreground',
};

// "Live", "Hidden · no price", "Draft"… with a one-tap fix for the missing price.
function VisibilityBadge({ product, onFix }: { product: ProductRow; onFix: () => void }) {
  const v = shopVisibility(product);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span title={v.hint} className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap ${TONE[v.tone]}`}>
        {v.label}
      </span>
      {!v.live && v.needsPrice && (
        <button type="button" onClick={onFix} className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap">
          Set price →
        </button>
      )}
    </span>
  );
}

function SeoChip({ product }: { product: ProductRow }) {
  const { passed, total } = seoScore(product);
  const tone = passed >= total - 1 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : passed >= total - 3 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-destructive bg-destructive/5 border-destructive/20';
  return (
    <span title="SEO & listing quality — open Edit to see what's missing" className={`px-1.5 py-0.5 rounded border text-[10px] font-bold tabular-nums ${tone}`}>
      SEO {passed}/{total}
    </span>
  );
}

const STATUS_OPTIONS = ['active', 'inactive', 'draft'] as const;

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [stockFor, setStockFor] = useState<ProductRow | null>(null);
  const [reviewsFor, setReviewsFor] = useState<ProductRow | null>(null);

  const { data: productsData, isLoading } = useListProducts(
    // includeUnpriced: admins also need to see products that aren't priced yet.
    { search: search || undefined, limit: 100, includeUnpriced: '1' } as any,
    { query: { queryKey: ['admin', 'products', search] } as any },
  );
  const { data: categories } = useListCategories();
  const deleteMutation = useDeleteProduct();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const refetchProducts = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        Array.isArray(q.queryKey) && q.queryKey[0] === 'admin' && q.queryKey[1] === 'products',
    });

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteMutation.mutateAsync({ id });
      await refetchProducts();
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: 'Product deleted' });
    } catch (e) {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const unpriced = ((productsData?.items ?? []) as ProductRow[]).filter((p) => {
    const v = shopVisibility(p);
    return !v.live && v.needsPrice;
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: ProductRow) => {
    setEditing(product);
    setDialogOpen(true);
  };

  // Row actions, shared by the desktop table and the phone card list.
  const rowMenu = (product: ProductRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" aria-label={`Actions for ${product.name}`}>
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(product)}>
          <Pencil className="w-4 h-4 mr-2" /> Edit
        </DropdownMenuItem>
        {shopVisibility(product).live && (
          <DropdownMenuItem asChild className="cursor-pointer">
            <a href={productPath(product)} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" /> View in shop
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer" onClick={() => setStockFor(product)}>
          <Boxes className="w-4 h-4 mr-2" /> Manage stock &amp; variants
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => setReviewsFor(product)}>
          <Star className="w-4 h-4 mr-2" /> Reviews
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => handleDelete(product.id)}>
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Products</h1>
            <p className="text-muted-foreground mt-1">Manage your catalogue and inventory.</p>
          </div>
          <Button className="font-bold shadow-md shadow-primary/20" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>

        {unpriced.length > 0 && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {unpriced.length === 1 ? '1 product is' : `${unpriced.length} products are`} hidden from customers — no selling price yet
            </p>
            <p className="text-sm mt-1">
              A product appears in the shop once at least one of its options has a price above KES 0. Tap a product to set it.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {unpriced.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setStockFor(p)}
                  className="max-w-full inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold hover:border-amber-500"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-primary">· Set price</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-muted/10 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Phone: card per product so price, stock and actions are always visible */}
          <div className="md:hidden divide-y">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-muted-foreground">Loading products…</div>
            ) : productsData?.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">No products found.</div>
            ) : (
              productsData?.items.map((product) => (
                <div key={product.id} className="p-4 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground/30" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug line-clamp-2">{product.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.categoryName || 'Uncategorised'}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="font-bold text-sm">{product.basePrice > 0 ? formatCurrency(product.basePrice) : 'No price'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${(product.totalStock || 0) <= 10 ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'}`}>
                        {product.totalStock || 0} in stock
                      </span>
                      <SeoChip product={product as ProductRow} />
                    </div>
                    <div className="mt-1.5">
                      <VisibilityBadge product={product as ProductRow} onFix={() => setStockFor(product as ProductRow)} />
                    </div>
                  </div>
                  {rowMenu(product as ProductRow)}
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b">
                <tr>
                  <th className="px-6 py-4 font-bold">Product</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Price</th>
                  <th className="px-6 py-4 font-bold">Stock</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center">Loading products...</td></tr>
                ) : productsData?.items.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No products found.</td></tr>
                ) : (
                  productsData?.items.map((product) => (
                    <tr key={product.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-muted-foreground/30" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-foreground line-clamp-1">{product.name}</div>
                            <div className="mt-1"><SeoChip product={product as ProductRow} /></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{product.categoryName || '-'}</td>
                      <td className="px-6 py-4 font-bold whitespace-nowrap">
                        {product.basePrice > 0 ? formatCurrency(product.basePrice) : <span className="text-amber-700">No price</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          (product.totalStock || 0) <= 10 ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'
                        }`}>
                          {product.totalStock || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <VisibilityBadge product={product as ProductRow} onFix={() => setStockFor(product as ProductRow)} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        {rowMenu(product as ProductRow)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ProductFormDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={editing}
          categories={categories ?? []}
          onSaved={async (saved, created) => {
            await refetchProducts();
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            // A new product has no price or stock yet — go straight to adding them.
            if (created && saved) setStockFor(saved);
          }}
        />

        <ManageReviewsDialog
          productId={reviewsFor?.id ?? null}
          productName={reviewsFor?.name ?? ''}
          open={reviewsFor != null}
          onOpenChange={(open) => !open && setReviewsFor(null)}
        />

        <ManageVariantsDialog
          productId={stockFor?.id ?? null}
          productName={stockFor?.name ?? ''}
          open={stockFor != null}
          onOpenChange={(open) => !open && setStockFor(null)}
        />
      </AdminLayout>
    </AuthGuard>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductRow | null;
  categories: Array<{ id: number; name: string }>;
  onSaved: (saved: ProductRow | null, created: boolean) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const { data: deliveryClasses } = useQuery({ queryKey: ['delivery-classes'], queryFn: fetchDeliveryClasses });
  const isEdit = Boolean(product);

  const initial = useMemo(
    () => ({
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      description: product?.description ?? '',
      categoryId: product?.categoryId != null ? String(product.categoryId) : '',
      imageUrl: product?.imageUrl ?? '',
      images: (product?.images ?? []) as string[],
      status: product?.status ?? 'active',
      featured: product?.featured ?? false,
      deliveryClassId: product?.deliveryClassId != null ? String(product.deliveryClassId) : 'none',
      tags: (product?.tags ?? []).join(', '),
      retailPrice: product?.compareAtPrice ? String(product.compareAtPrice) : '',
      metaTitle: product?.metaTitle ?? '',
      metaDescription: product?.metaDescription ?? '',
    }),
    [product],
  );

  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const categoryId = Number(form.categoryId);
    if (!form.name.trim() || !form.slug.trim() || !categoryId) {
      toast({ title: 'Please fill in name, slug and category.', variant: 'destructive' });
      return;
    }

    // Price is set per variant (under Manage stock) and derived from there.
    const payload: ProductInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      categoryId,
      imageUrl: form.imageUrl.trim() || undefined,
      images: form.images.map((s) => s.trim()).filter(Boolean),
      status: form.status as ProductInput['status'],
      featured: form.featured,
      deliveryClassId: form.deliveryClassId && form.deliveryClassId !== 'none' ? Number(form.deliveryClassId) : null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      // Typical retail price — shown struck through so shoppers see their
      // wholesale saving. Sending 0 on edit clears a previously-set value.
      ...(Number(form.retailPrice) > 0 ? { compareAtPrice: Number(form.retailPrice) } : isEdit ? { compareAtPrice: 0 } : {}),
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
    };

    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({ id: product.id, data: payload });
        toast({ title: 'Product updated' });
        await onSaved(null, false);
      } else {
        const created = await createMutation.mutateAsync({ data: payload });
        toast({ title: 'Product created', description: 'Now add its price and stock — it shows in the shop once it has a price.' });
        await onSaved(created as ProductRow, true);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: isEdit ? 'Failed to update product' : 'Failed to create product',
        description: err?.data?.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                set('name', name);
                if (!slugTouched) set('slug', slugify(name));
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              required
            />
            <p className="text-xs text-muted-foreground break-all">
              Page address: <span className="font-mono">{previewUrl({ id: product?.id, name: form.name, slug: slugify(form.slug) }, window.location.origin)}</span>
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
          </div>
          <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
            Pricing and stock are set per variant under <span className="font-medium text-foreground">Manage stock</span>.
            The product's shown price is the lowest variant price.
          </div>
          <div className="space-y-2">
            <Label htmlFor="retailPrice">Typical retail price (KES) <span className="text-muted-foreground font-normal">— optional</span></Label>
            <Input
              id="retailPrice"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={form.retailPrice}
              onChange={(e) => set('retailPrice', e.target.value)}
              placeholder="e.g. 5200"
            />
            <p className="text-xs text-muted-foreground">
              What shoppers would normally pay in other shops. We show it struck through next to your wholesale price with
              “You save KES X”. Enter a real price you can stand behind, and leave it blank to show no comparison.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delivery class</Label>
            <Select value={form.deliveryClassId} onValueChange={(v) => set('deliveryClassId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Standard (town base rate)</SelectItem>
                {(deliveryClasses ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Controls this product's delivery cost per town.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-tags">Tags</Label>
            <Input
              id="prod-tags"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="e.g. organic, leather, size-l"
            />
            <p className="text-xs text-muted-foreground">Comma-separated. Shoppers filter a collection by these (the "Refine" facet).</p>
          </div>

          <MediaPicker value={form.imageUrl} onChange={(url) => set('imageUrl', url)} label="Main image" />

          {/* Gallery — additional photos shown as thumbnails on the product page */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Gallery images</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, images: [...f.images, ''] }))}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add image
              </Button>
            </div>
            {form.images.length === 0 && (
              <p className="text-xs text-muted-foreground">Add more photos (angles, in use, colour close-ups). They appear as thumbnails alongside the main image.</p>
            )}
            <div className="space-y-3">
              {form.images.map((img, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1">
                    <MediaPicker
                      value={img}
                      onChange={(url) =>
                        setForm((f) => {
                          const next = f.images.slice();
                          next[i] = url;
                          return { ...f, images: next };
                        })
                      }
                      label={`Image ${i + 2}`}
                    />
                  </div>
                  <button
                    type="button"
                    className="mt-7 text-muted-foreground hover:text-destructive p-2 shrink-0"
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <SeoSection
            form={form}
            product={product}
            categoryId={Number(form.categoryId) || null}
            onTitle={(v) => set('metaTitle', v)}
            onDescription={(v) => set('metaDescription', v)}
          />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="featured" className="font-medium">Featured</Label>
              <p className="text-xs text-muted-foreground">Highlight on the storefront homepage.</p>
            </div>
            <Switch id="featured" checked={form.featured} onCheckedChange={(v) => set('featured', v)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// "How this product looks on Google" + an editable title/description + a checklist.
function SeoSection({
  form,
  product,
  categoryId,
  onTitle,
  onDescription,
}: {
  form: { name: string; slug: string; description: string; imageUrl: string; images: string[]; tags: string; retailPrice: string; metaTitle: string; metaDescription: string };
  product: ProductRow | null;
  categoryId: number | null;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  const seo = {
    id: product?.id,
    name: form.name,
    slug: slugify(form.slug),
    description: form.description,
    basePrice: product?.basePrice ?? 0,
    compareAtPrice: Number(form.retailPrice) || null,
    categoryId,
    imageUrl: form.imageUrl,
    images: form.images.filter(Boolean),
    tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    totalStock: product?.totalStock ?? 0,
  };
  const autoTitle = autoSeoTitle(seo);
  const autoDesc = autoSeoDescription(seo);
  const title = form.metaTitle.trim() || autoTitle;
  const desc = form.metaDescription.trim() || autoDesc;
  const checks = seoChecklist(seo);
  const passed = checks.filter((c) => c.ok).length;
  const clipTo = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">Search engine listing (SEO)</p>
          <p className="text-xs text-muted-foreground">How this product can appear on Google. Leave the fields blank to use the automatic text.</p>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums rounded-full bg-muted px-2 py-1">{passed}/{checks.length}</span>
      </div>

      {/* Google-style preview */}
      <div className="rounded-md bg-white border p-3 text-left">
        <p className="text-[12px] text-[#202124] truncate">{previewUrl(seo, window.location.origin)}</p>
        <p className="text-[17px] leading-snug text-[#1a0dab] line-clamp-2">{clipTo(title, 70)}</p>
        <p className="text-[13px] leading-snug text-[#4d5156] line-clamp-3">{clipTo(desc, 170)}</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="metaTitle" className="text-xs">SEO title</Label>
          <span className={`text-[11px] tabular-nums ${title.length > TITLE_MAX ? 'text-amber-700' : 'text-muted-foreground'}`}>{title.length}/{TITLE_MAX}</span>
        </div>
        <Input id="metaTitle" value={form.metaTitle} onChange={(e) => onTitle(e.target.value)} placeholder={autoTitle} maxLength={200} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="metaDescription" className="text-xs">SEO description</Label>
          <span className={`text-[11px] tabular-nums ${desc.length > DESC_MAX + 10 ? 'text-amber-700' : 'text-muted-foreground'}`}>{desc.length}/{DESC_MAX}</span>
        </div>
        <Textarea id="metaDescription" value={form.metaDescription} onChange={(e) => onDescription(e.target.value)} placeholder={autoDesc} rows={3} maxLength={500} />
        <p className="text-[11px] text-muted-foreground">Google shows about {DESC_MAX} characters. The automatic text already includes the live price and your saving.</p>
      </div>

      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-xs">
            {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <Circle className="w-4 h-4 text-amber-500 shrink-0" />}
            <span>
              <span className={c.ok ? 'text-foreground' : 'font-medium text-foreground'}>{c.label}</span>
              {!c.ok && <span className="block text-muted-foreground">{c.tip}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
