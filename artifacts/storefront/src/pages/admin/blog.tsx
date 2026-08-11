import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaPicker } from '@/components/media/MediaPicker';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, ExternalLink, Newspaper } from 'lucide-react';
import { formatPostDate, type BlogPost } from '@/lib/blog';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

async function listPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${API_BASE}/api/admin/blog-posts`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

type PostForm = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  author: string;
  tags: string;
  status: 'draft' | 'published';
  metaTitle: string;
  metaDescription: string;
};

function toForm(p: BlogPost | null): PostForm {
  return {
    title: p?.title ?? '',
    slug: p?.slug ?? '',
    excerpt: p?.excerpt ?? '',
    content: p?.content ?? '',
    coverImageUrl: p?.coverImageUrl ?? '',
    author: p?.author ?? 'Happyfine',
    tags: p?.tags?.join(', ') ?? '',
    status: p?.status ?? 'draft',
    metaTitle: p?.metaTitle ?? '',
    metaDescription: p?.metaDescription ?? '',
  };
}

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

export default function AdminBlog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: posts, isLoading } = useQuery({ queryKey: ['admin', 'blog-posts'], queryFn: listPosts });
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PostForm>(toForm(null));
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const set = <K extends keyof PostForm>(k: K, v: PostForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'blog-posts'] });
    queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
  };

  const openNew = () => { setEditing(null); setForm(toForm(null)); setSlugTouched(false); setOpen(true); };
  const openEdit = (p: BlogPost) => { setEditing(p); setForm(toForm(p)); setSlugTouched(true); setOpen(true); };

  const save = async () => {
    if (!form.title.trim()) { toast({ title: 'A title is required', variant: 'destructive' }); return; }
    setSaving(true);
    const body = {
      ...form,
      slug: form.slug.trim() || slugify(form.title),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    const url = editing ? `${API_BASE}/api/blog-posts/${editing.id}` : `${API_BASE}/api/blog-posts`;
    const res = await fetch(url, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: 'Could not save', description: data.error || 'Please try again.', variant: 'destructive' });
      return;
    }
    setOpen(false);
    refresh();
    toast({ title: editing ? 'Post updated' : 'Post created' });
  };

  const remove = async (p: BlogPost) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await fetch(`${API_BASE}/api/blog-posts/${p.id}`, { method: 'DELETE', credentials: 'include' });
    refresh();
    toast({ title: 'Post deleted' });
  };

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Newspaper className="w-6 h-6 text-primary" /> Journal</h1>
            <p className="text-muted-foreground text-sm mt-1">Write posts, control SEO, and publish to your blog.</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1.5" /> New post</Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !posts?.length ? (
          <div className="border border-dashed rounded-xl p-12 text-center text-muted-foreground">
            No posts yet. Click <span className="font-semibold text-foreground">New post</span> to write your first.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden bg-card divide-y">
            {posts.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4">
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
                  {p.coverImageUrl && <img src={p.coverImageUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{p.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">/{p.slug} · {formatPostDate(p.publishedAt || p.createdAt)}</p>
                </div>
                {p.status === 'published' && (
                  <a href={`/blog/${p.slug}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary" title="View post">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(p)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? 'Edit post' : 'New post'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)); }}
                  placeholder="How to buy cookware in bulk"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL slug</Label>
                  <Input value={form.slug} onChange={(e) => { setSlugTouched(true); set('slug', e.target.value); }} placeholder="buy-cookware-in-bulk" />
                </div>
                <div className="space-y-2">
                  <Label>Author</Label>
                  <Input value={form.author} onChange={(e) => set('author', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Excerpt (shown in listings)</Label>
                <Textarea value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} rows={2} placeholder="A short summary…" />
              </div>
              <MediaPicker value={form.coverImageUrl} onChange={(url) => set('coverImageUrl', url)} label="Cover image" />
              <div className="space-y-2">
                <Label>Content (Markdown)</Label>
                <Textarea value={form.content} onChange={(e) => set('content', e.target.value)} rows={12} className="font-mono text-sm" placeholder={'## A heading\n\nWrite your post in **Markdown** — headings, **bold**, *italic*, [links](https://…), - lists.'} />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Guides, Kitchen" />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">SEO (Google)</p>
                <div className="space-y-2">
                  <Label>Meta title <span className="text-muted-foreground font-normal">(defaults to title)</span></Label>
                  <Input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Meta description <span className="text-muted-foreground font-normal">(~155 chars)</span></Label>
                  <Textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={2} maxLength={160} />
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm font-medium">Published {form.status === 'published' ? '(live)' : '(draft)'}</span>
                <Switch checked={form.status === 'published'} onCheckedChange={(v) => set('status', v ? 'published' : 'draft')} />
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create post'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AuthGuard>
  );
}
