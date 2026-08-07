import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MediaPicker } from '@/components/media/MediaPicker';
import { PromoBlock, type HomepageBlock } from '@/components/home/PromoBlock';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, LayoutGrid } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

async function listBlocks(): Promise<HomepageBlock[]> {
  const res = await fetch(`${API_BASE}/api/admin/homepage-blocks`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}
async function saveBlock(id: number | null, body: Partial<HomepageBlock>) {
  const url = id ? `${API_BASE}/api/homepage-blocks/${id}` : `${API_BASE}/api/homepage-blocks`;
  const res = await fetch(url, {
    method: id ? 'PATCH' : 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to save block');
  return res.json();
}
async function deleteBlock(id: number) {
  await fetch(`${API_BASE}/api/homepage-blocks/${id}`, { method: 'DELETE', credentials: 'include' });
}

const V = ['top', 'center', 'bottom'];
const H = ['left', 'center', 'right'];
const ALIGNMENTS = V.flatMap((v) => H.map((h) => `${v}-${h}`));
const ASPECTS = ['16/9', '21/9', '4/3', '3/2', '1/1', '4/5', '3/4'];
const SPANS = [12, 8, 6, 4, 3];

type BlockForm = {
  placement: 'hero' | 'grid';
  kind: 'image' | 'color' | 'video';
  imageUrl: string;
  videoUrl: string;
  backgroundColor: string;
  overlayOpacity: number;
  columnSpan: number;
  hideOnMobile: boolean;
  aspectRatio: string;
  heading: string;
  subheading: string;
  ctaLabel: string;
  ctaHref: string;
  textAlign: string;
  textColor: string;
  sortOrder: number;
  active: boolean;
};

function toForm(b: HomepageBlock | null): BlockForm {
  return {
    placement: b?.placement ?? 'grid',
    kind: b?.kind ?? 'image',
    imageUrl: b?.imageUrl ?? '',
    videoUrl: b?.videoUrl ?? '',
    backgroundColor: b?.backgroundColor ?? '#111827',
    overlayOpacity: b?.overlayOpacity ?? 30,
    columnSpan: b?.columnSpan ?? 12,
    hideOnMobile: b?.hideOnMobile ?? false,
    aspectRatio: b?.aspectRatio ?? '16/9',
    heading: b?.heading ?? '',
    subheading: b?.subheading ?? '',
    ctaLabel: b?.ctaLabel ?? '',
    ctaHref: b?.ctaHref ?? '',
    textAlign: b?.textAlign ?? 'bottom-left',
    textColor: b?.textColor ?? '#ffffff',
    sortOrder: b?.sortOrder ?? 0,
    active: b?.active ?? true,
  };
}

export default function AdminHomepage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: blocks, isLoading } = useQuery({ queryKey: ['admin', 'homepage-blocks'], queryFn: listBlocks });
  const [editing, setEditing] = useState<HomepageBlock | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'homepage-blocks'] });
    queryClient.invalidateQueries({ queryKey: ['homepage-blocks'] });
  };

  const remove = async (b: HomepageBlock) => {
    if (!confirm('Delete this block?')) return;
    await deleteBlock(b.id);
    refresh();
    toast({ title: 'Block deleted' });
  };

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Homepage Blocks</h1>
            <p className="text-muted-foreground mt-1">Build the homepage banner grid. Blocks flow left-to-right by order and stack on mobile.</p>
          </div>
          <Button className="font-bold" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Block
          </Button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : !blocks || blocks.length === 0 ? (
          <div className="text-center py-16 bg-muted/30 border border-dashed rounded-xl">
            <LayoutGrid className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg">No blocks yet</h3>
            <p className="text-muted-foreground mt-1">Until you add one, the homepage shows the default hero.</p>
          </div>
        ) : (
          <>
            {/* Live preview of the actual grid */}
            <div className="mb-8 rounded-xl border p-4 bg-muted/10">
              <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Live preview</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0,1fr))', gap: '0.75rem' }}>
                {blocks.filter((b) => b.active).map((b) => (
                  <div key={b.id} style={{ gridColumn: `span ${Math.min(Math.max(b.columnSpan, 1), 12)}` }}>
                    <PromoBlock block={b} animate={false} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {blocks.map((b) => (
                <div key={b.id} className="flex items-center gap-4 bg-card border rounded-lg p-3">
                  <div className="w-10 h-10 rounded border shrink-0 overflow-hidden bg-muted flex items-center justify-center" style={{ background: b.kind === 'color' ? b.backgroundColor ?? undefined : undefined }}>
                    {b.kind === 'image' && b.imageUrl ? <img src={b.imageUrl} alt="" className="w-full h-full object-cover" /> : <LayoutGrid className="w-4 h-4 text-muted-foreground/40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{b.heading || <span className="text-muted-foreground">(no heading)</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      {(b.placement ?? 'grid') === 'hero' ? 'hero' : `grid · span ${b.columnSpan}`} · {b.kind} · {b.textAlign}{b.hideOnMobile ? ' · hidden on mobile' : ''}{!b.active ? ' · inactive' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">#{b.sortOrder}</span>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(b)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          </>
        )}

        <BlockDialog key={editing?.id ?? 'new'} block={editing} open={open} onOpenChange={setOpen} onSaved={refresh} />
      </AdminLayout>
    </AuthGuard>
  );
}

function BlockDialog({ block, open, onOpenChange, onSaved }: { block: HomepageBlock | null; open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<BlockForm>(() => toForm(block));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof BlockForm>(k: K, v: BlockForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const previewBlock = useMemo<HomepageBlock>(() => ({ id: -1, ...form }), [form]);

  const submit = async () => {
    setSaving(true);
    try {
      await saveBlock(block?.id ?? null, form as any);
      toast({ title: block ? 'Block updated' : 'Block created' });
      onSaved();
      onOpenChange(false);
    } catch {
      toast({ title: 'Failed to save block', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{block ? 'Edit block' : 'Add block'}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg overflow-hidden border mb-2">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))' }}>
            <div style={{ gridColumn: 'span 12' }}><PromoBlock block={previewBlock} animate={false} /></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Placement</Label>
            <Select value={form.placement} onValueChange={(v) => set('placement', v as BlockForm['placement'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hero">Hero slideshow (rotates at top)</SelectItem>
                <SelectItem value="grid">Grid block (below the hero)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Background type</Label>
            <Select value={form.kind} onValueChange={(v) => set('kind', v as BlockForm['kind'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="color">Solid colour</SelectItem>
                <SelectItem value="video">Video (muted loop)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Column span (of 12){form.placement === 'hero' ? ' — hero is always full-width' : ''}</Label>
            <Select value={String(form.columnSpan)} onValueChange={(v) => set('columnSpan', Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPANS.map((s) => <SelectItem key={s} value={String(s)}>{s} — {s === 12 ? 'full' : s === 6 ? 'half' : s === 4 ? 'third' : s === 3 ? 'quarter' : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {form.kind === 'image' && (
          <MediaPicker value={form.imageUrl} onChange={(url) => set('imageUrl', url)} label="Background image" />
        )}
        {form.kind === 'video' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Video URL (.mp4/.webm)</Label>
              <Input value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://…" />
            </div>
            <MediaPicker value={form.imageUrl} onChange={(url) => set('imageUrl', url)} label="Poster image" />
          </div>
        )}
        {form.kind === 'color' && (
          <div className="space-y-2">
            <Label>Background colour</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.backgroundColor} onChange={(e) => set('backgroundColor', e.target.value)} className="h-9 w-12 rounded border" />
              <Input value={form.backgroundColor} onChange={(e) => set('backgroundColor', e.target.value)} className="w-32" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <Select value={form.aspectRatio} onValueChange={(v) => set('aspectRatio', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASPECTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Text position</Label>
            <Select value={form.textAlign} onValueChange={(v) => set('textAlign', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ALIGNMENTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Heading</Label>
          <Input value={form.heading} onChange={(e) => set('heading', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Subheading</Label>
          <Textarea value={form.subheading} onChange={(e) => set('subheading', e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Button label</Label>
            <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Shop now" />
          </div>
          <div className="space-y-2">
            <Label>Link (href)</Label>
            <Input value={form.ctaHref} onChange={(e) => set('ctaHref', e.target.value)} placeholder="/products" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Text colour</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.textColor} onChange={(e) => set('textColor', e.target.value)} className="h-9 w-12 rounded border" />
              <Input value={form.textColor} onChange={(e) => set('textColor', e.target.value)} className="w-32" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Overlay darkness ({form.overlayOpacity}%)</Label>
            <input type="range" min={0} max={100} value={form.overlayOpacity} onChange={(e) => set('overlayOpacity', Number(e.target.value))} className="w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div className="space-y-2">
            <Label>Order</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', Number(e.target.value) || 0)} className="w-24" />
          </div>
          <div className="flex flex-col gap-3 pt-1">
            <label className="flex items-center justify-between">
              <span className="text-sm">Hide on mobile</span>
              <Switch checked={form.hideOnMobile} onCheckedChange={(v) => set('hideOnMobile', v)} />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm">Active</span>
              <Switch checked={form.active} onCheckedChange={(v) => set('active', v)} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : block ? 'Save' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
