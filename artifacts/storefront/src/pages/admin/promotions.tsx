import React, { useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, Pause, Play, Megaphone, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BannerCard, PROMOTION_THEMES } from '@/components/promotions/PromotionBanner';
import type { PromotionTheme } from '@/hooks/usePromotion';
import { PROMO_PRESETS, nextRange, toNairobiInput, fromNairobiInput, formatNairobi } from '@/lib/promoPresets';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

type Status = 'live' | 'scheduled' | 'ended' | 'off';
interface Promo {
  id: number;
  name: string;
  title: string;
  subtitle: string;
  announcement: string;
  ctaLabel: string;
  ctaHref: string;
  theme: PromotionTheme;
  showCountdown: boolean;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  status: Status;
}

interface FormState {
  name: string;
  title: string;
  subtitle: string;
  announcement: string;
  ctaLabel: string;
  ctaHref: string;
  theme: PromotionTheme;
  showCountdown: boolean;
  startsAt: string; // Nairobi wall time for <input type="datetime-local">
  endsAt: string;
  enabled: boolean;
}

const blankForm = (): FormState => {
  const start = new Date(Date.now() + 3_600_000);
  start.setMinutes(0, 0, 0);
  return {
    name: '', title: '', subtitle: '', announcement: '', ctaLabel: 'Shop the deals', ctaHref: '/products',
    theme: 'brand', showCountdown: true,
    startsAt: toNairobiInput(start.toISOString()),
    endsAt: toNairobiInput(new Date(start.getTime() + 7 * 86_400_000).toISOString()),
    enabled: true,
  };
};

const fromPromo = (p: Promo): FormState => ({
  name: p.name, title: p.title, subtitle: p.subtitle, announcement: p.announcement, ctaLabel: p.ctaLabel, ctaHref: p.ctaHref,
  theme: p.theme, showCountdown: p.showCountdown, startsAt: toNairobiInput(p.startsAt), endsAt: toNairobiInput(p.endsAt), enabled: p.enabled,
});

const bodyOf = (f: FormState) => ({ ...f, startsAt: fromNairobiInput(f.startsAt), endsAt: fromNairobiInput(f.endsAt) });

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Live now', cls: 'bg-emerald-100 text-emerald-700' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' },
  ended: { label: 'Ended', cls: 'bg-muted text-muted-foreground' },
  off: { label: 'Paused', cls: 'bg-amber-100 text-amber-700' },
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export default function AdminPromotions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promotions'],
    queryFn: () => api('/api/admin/promotions') as Promise<{ items: Promo[] }>,
  });
  const items = data?.items ?? [];

  const [editing, setEditing] = useState<{ id: number | null; form: FormState } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
    queryClient.invalidateQueries({ queryKey: ['promotions-active'] }); // storefront banner
  };

  const toggle = async (p: Promo) => {
    try {
      await api(`/api/admin/promotions/${p.id}`, { method: 'PUT', body: JSON.stringify({ ...p, enabled: !p.enabled }) });
      refresh();
      toast({ title: p.enabled ? 'Promotion paused' : 'Promotion resumed' });
    } catch (e: any) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    }
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Delete “${p.name}”? This can't be undone.`)) return;
    try {
      await api(`/api/admin/promotions/${p.id}`, { method: 'DELETE' });
      refresh();
      toast({ title: 'Promotion deleted' });
    } catch (e: any) {
      toast({ title: 'Could not delete', description: e?.message, variant: 'destructive' });
    }
  };

  // Copy a past campaign forward a year — the quickest way to run it again.
  const duplicate = (p: Promo) => {
    const f = fromPromo(p);
    const bump = (v: string) => `${Number(v.slice(0, 4)) + 1}${v.slice(4)}`;
    setEditing({ id: null, form: { ...f, name: `${p.name} (copy)`, startsAt: bump(f.startsAt), endsAt: bump(f.endsAt), enabled: true } });
  };

  const groups: { title: string; list: Promo[] }[] = [
    { title: 'Live now', list: items.filter((p) => p.status === 'live') },
    { title: 'Scheduled', list: items.filter((p) => p.status === 'scheduled') },
    { title: 'Paused', list: items.filter((p) => p.status === 'off') },
    { title: 'Ended', list: items.filter((p) => p.status === 'ended').reverse() },
  ].filter((g) => g.list.length > 0);

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Promotions</h1>
            <p className="text-muted-foreground mt-1">Schedule campaigns — Black Friday, Christmas, flash sales. They go live and end on their own.</p>
          </div>
          <Button className="font-bold shadow-md shadow-primary/20" onClick={() => setEditing({ id: null, form: blankForm() })}>
            <Plus className="w-4 h-4 mr-2" /> New promotion
          </Button>
        </div>

        <div className="mb-6 flex gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <p>
            A promotion is the <strong className="text-foreground">campaign banner, countdown and top-bar message</strong>. The actual price cuts are set per product under{' '}
            <a href="/admin/offers" className="text-primary font-medium hover:underline">Offers</a> — so only promise a discount you've set there.
          </p>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center bg-card border border-dashed rounded-xl">
            <Megaphone className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-semibold">No promotions yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Start from a season — dates are filled in for you.</p>
            <Button onClick={() => setEditing({ id: null, form: blankForm() })}><Plus className="w-4 h-4 mr-2" /> Create your first promotion</Button>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.title}>
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">{g.title}</h2>
                <div className="space-y-3">
                  {g.list.map((p) => (
                    <div key={p.id} className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold truncate">{p.name}</span>
                          <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', STATUS_STYLE[p.status].cls)}>{STATUS_STYLE[p.status].label}</span>
                          <span className={cn('w-3 h-3 rounded-full border', PROMOTION_THEMES[p.theme]?.swatch)} title={PROMOTION_THEMES[p.theme]?.label} />
                        </div>
                        <p className="text-sm mt-1 truncate">“{p.title}”{p.subtitle ? ` — ${p.subtitle}` : ''}</p>
                        <p className="text-xs text-muted-foreground mt-1">{formatNairobi(p.startsAt)} → {formatNairobi(p.endsAt)} <span className="opacity-70">(Nairobi time)</span></p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <Button variant="outline" size="sm" onClick={() => setEditing({ id: p.id, form: fromPromo(p) })}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
                        {p.status !== 'ended' && (
                          <Button variant="outline" size="sm" onClick={() => toggle(p)}>
                            {p.enabled ? <><Pause className="w-3.5 h-3.5 mr-1.5" /> Pause</> : <><Play className="w-3.5 h-3.5 mr-1.5" /> Resume</>}
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => duplicate(p)} title="Run it again next year"><Copy className="w-3.5 h-3.5 mr-1.5" /> Reuse</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {editing && (
          <PromotionDialog
            key={editing.id ?? 'new'}
            initial={editing.form}
            id={editing.id}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); refresh(); }}
          />
        )}
      </AdminLayout>
    </AuthGuard>
  );
}

function PromotionDialog({ initial, id, onClose, onSaved }: { initial: FormState; id: number | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(initial);
  const [tag, setTag] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const applyPreset = (key: string) => {
    const preset = PROMO_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const r = nextRange(preset);
    setTag(preset.tag);
    setForm((f) => ({
      ...f, name: preset.name(r.year), title: preset.title, subtitle: preset.subtitle, announcement: preset.announcement,
      ctaLabel: preset.ctaLabel, theme: preset.theme, startsAt: r.start, endsAt: r.end,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(id ? `/api/admin/promotions/${id}` : '/api/admin/promotions', { method: id ? 'PUT' : 'POST', body: JSON.stringify(bodyOf(form)) });
      toast({ title: id ? 'Promotion updated' : 'Promotion created', description: 'It goes live automatically at the start time.' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const quickLinks = [
    { label: 'All products', href: '/products' },
    { label: 'Under 1,000', href: '/products?maxPrice=1000&sort=price_asc' },
    { label: 'Under 2,500', href: '/products?maxPrice=2500&sort=price_asc' },
    ...(tag ? [{ label: `Tagged “${tag}”`, href: `/products?tags=${tag}` }] : []),
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{id ? 'Edit promotion' : 'New promotion'}</DialogTitle>
        </DialogHeader>

        {!id && (
          <div>
            <Label className="text-xs text-muted-foreground">Start from a season</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PROMO_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => applyPreset(p.key)}
                  className="h-9 px-3.5 rounded-full text-sm font-medium border bg-background hover:border-primary hover:text-primary transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* What shoppers will see */}
        <div>
          <Label className="text-xs text-muted-foreground">Preview</Label>
          <div className="mt-2">
            <BannerCard
              preview
              compact
              msLeft={((3 * 24 + 4) * 3600 + 27 * 60 + 9) * 1000}
              data={{ title: form.title || 'Your headline', subtitle: form.subtitle, ctaLabel: form.ctaLabel || 'Shop the deals', ctaHref: form.ctaHref, theme: form.theme, showCountdown: form.showCountdown }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-name">Internal name</Label>
            <Input id="p-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Black Friday 2026" />
            <p className="text-xs text-muted-foreground">Only you see this.</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-title">Headline</Label>
            <Input id="p-title" value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="Black Friday" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-sub">Sub-headline <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="p-sub" value={form.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={240} placeholder="Special wholesale deals — while stock lasts." />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="p-ann">Top-bar message <span className="text-muted-foreground font-normal">(optional — replaces the bar at the top of every page while live)</span></Label>
            <Input id="p-ann" value={form.announcement} onChange={(e) => set('announcement', e.target.value)} maxLength={160} placeholder="Black Friday deals are live — shop now" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-cta">Button text</Label>
            <Input id="p-cta" value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-href">Button link</Label>
            <Input id="p-href" value={form.ctaHref} onChange={(e) => set('ctaHref', e.target.value)} placeholder="/products" />
          </div>
          <div className="sm:col-span-2 -mt-2">
            <div className="flex flex-wrap gap-1.5">
              {quickLinks.map((l) => (
                <button key={l.href} type="button" onClick={() => set('ctaHref', l.href)}
                  className={cn('text-xs rounded-full px-3 py-1 border transition-colors', form.ctaHref === l.href ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground hover:border-primary/50')}>
                  {l.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Tip: give your promo products a tag (e.g. “black-friday”) and link here to show only those.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-start">Starts <span className="text-muted-foreground font-normal">(Nairobi time)</span></Label>
            <Input id="p-start" type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-end">Ends <span className="text-muted-foreground font-normal">(Nairobi time)</span></Label>
            <Input id="p-end" type="datetime-local" value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROMOTION_THEMES) as PromotionTheme[]).map((t) => (
                <button key={t} type="button" onClick={() => set('theme', t)}
                  className={cn('flex items-center gap-2 h-9 px-3 rounded-full border text-sm transition-colors', form.theme === t ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary/50')}>
                  <span className={cn('w-4 h-4 rounded-full border', PROMOTION_THEMES[t].swatch)} />
                  {PROMOTION_THEMES[t].label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer sm:col-span-2">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={form.showCountdown} onChange={(e) => set('showCountdown', e.target.checked)} />
            <span className="text-sm font-medium">Show a countdown to the end time</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer sm:col-span-2">
            <input type="checkbox" className="w-4 h-4 accent-primary" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            <span className="text-sm font-medium">Enabled <span className="text-muted-foreground font-normal">— untick to keep it as a draft</span></span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="font-bold" onClick={save} disabled={saving}>{saving ? 'Saving…' : id ? 'Save changes' : 'Create promotion'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
