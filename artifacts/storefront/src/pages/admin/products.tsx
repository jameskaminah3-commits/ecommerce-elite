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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
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
import { Boxes } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

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
  status?: string;
  featured?: boolean;
  totalStock?: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const STATUS_OPTIONS = ['active', 'inactive', 'draft'] as const;

export default function AdminProducts() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [stockFor, setStockFor] = useState<ProductRow | null>(null);

  const { data: productsData, isLoading } = useListProducts(
    { search: search || undefined, limit: 100 },
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

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: ProductRow) => {
    setEditing(product);
    setDialogOpen(true);
  };

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

          <div className="overflow-x-auto">
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
                          <div className="font-medium text-foreground line-clamp-1">{product.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{product.categoryName || '-'}</td>
                      <td className="px-6 py-4 font-bold">{formatCurrency(product.basePrice)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          (product.totalStock || 0) <= 10 ? 'bg-destructive/10 text-destructive' : 'bg-secondary/10 text-secondary'
                        }`}>
                          {product.totalStock || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          product.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="cursor-pointer" onClick={() => openEdit(product as ProductRow)}>
                              <Pencil className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={() => setStockFor(product as ProductRow)}>
                              <Boxes className="w-4 h-4 mr-2" /> Manage stock
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => handleDelete(product.id)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          onSaved={async () => {
            await refetchProducts();
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          }}
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
  onSaved: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const isEdit = Boolean(product);

  const initial = useMemo(
    () => ({
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      description: product?.description ?? '',
      basePrice: product?.basePrice != null ? String(product.basePrice) : '',
      compareAtPrice: product?.compareAtPrice != null ? String(product.compareAtPrice) : '',
      categoryId: product?.categoryId != null ? String(product.categoryId) : '',
      imageUrl: product?.imageUrl ?? '',
      status: product?.status ?? 'active',
      featured: product?.featured ?? false,
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

    const basePrice = Number(form.basePrice);
    const categoryId = Number(form.categoryId);
    if (!form.name.trim() || !form.slug.trim() || !categoryId || Number.isNaN(basePrice)) {
      toast({ title: 'Please fill in name, slug, category and a valid price.', variant: 'destructive' });
      return;
    }

    const payload: ProductInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      basePrice,
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      categoryId,
      imageUrl: form.imageUrl.trim() || undefined,
      status: form.status as ProductInput['status'],
      featured: form.featured,
    };

    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({ id: product.id, data: payload });
        toast({ title: 'Product updated' });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: 'Product created' });
      }
      await onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: isEdit ? 'Failed to update product' : 'Failed to create product', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice">Base Price (KES)</Label>
              <Input id="basePrice" type="number" min="0" step="1" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="compareAtPrice">Compare At (KES)</Label>
              <Input id="compareAtPrice" type="number" min="0" step="1" value={form.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} />
            </div>
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
          <MediaPicker value={form.imageUrl} onChange={(url) => set('imageUrl', url)} label="Image" />
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
