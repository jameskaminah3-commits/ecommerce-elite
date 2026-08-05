import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
  type Category,
  type CategoryInput,
} from '@workspace/api-client-react';
import { Plus, Pencil, Trash2, Grid, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MediaPicker } from '@/components/media/MediaPicker';
import { useQueryClient } from '@tanstack/react-query';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminCategories() {
  const { data: categories, isLoading } = useListCategories();
  const deleteMutation = useDeleteCategory();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListCategoriesQueryKey() });

  const handleDelete = async (category: Category) => {
    if ((category.productCount ?? 0) > 0) {
      toast({
        title: 'Cannot delete category',
        description: `Reassign or remove its ${category.productCount} product(s) first.`,
        variant: 'destructive',
      });
      return;
    }
    if (!confirm(`Delete category "${category.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ id: category.id });
      invalidate();
      toast({ title: 'Category deleted' });
    } catch (e) {
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    }
  };

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground mt-1">Organize your catalogue into collections.</p>
          </div>
          <Button
            className="font-bold shadow-md shadow-primary/20"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Category
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-card border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !categories || categories.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 border border-dashed rounded-xl">
            <Grid className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg">No categories yet</h3>
            <p className="text-muted-foreground mt-1">Create your first category to start organizing products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-card border rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-start gap-4 p-5">
                  <div className="w-14 h-14 rounded-lg border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold truncate">{category.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">/{category.slug}</p>
                    <span className="inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {category.productCount ?? 0} products
                    </span>
                  </div>
                </div>
                {category.description && (
                  <p className="px-5 text-sm text-muted-foreground line-clamp-2">{category.description}</p>
                )}
                <div className="mt-auto flex border-t divide-x">
                  <button
                    className="flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setEditing(category);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    className="flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => handleDelete(category)}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <CategoryFormDialog
          key={editing?.id ?? 'new'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          category={editing}
          onSaved={invalidate}
        />
      </AdminLayout>
    </AuthGuard>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const isEdit = Boolean(category);

  const initial = useMemo(
    () => ({
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
    }),
    [category],
  );

  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const isPending = createMutation.isPending || updateMutation.isPending;

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ title: 'Name and slug are required.', variant: 'destructive' });
      return;
    }
    const payload: CategoryInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
    };
    try {
      if (isEdit && category) {
        await updateMutation.mutateAsync({ id: category.id, data: payload });
        toast({ title: 'Category updated' });
      } else {
        await createMutation.mutateAsync({ data: payload });
        toast({ title: 'Category created' });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: isEdit ? 'Failed to update category' : 'Failed to create category', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Category' : 'Add Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
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
            <Label htmlFor="cat-slug">Slug</Label>
            <Input
              id="cat-slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set('slug', e.target.value);
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-description">Description</Label>
            <Textarea id="cat-description" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
          </div>
          <MediaPicker value={form.imageUrl} onChange={(url) => set('imageUrl', url)} label="Image" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
