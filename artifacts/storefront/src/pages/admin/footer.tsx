import React, { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface FooterLink { label: string; href: string }
interface SiteSettings {
  brandBlurb: string;
  aboutHeading: string;
  aboutLinks: FooterLink[];
  supportHeading: string;
  supportLinks: FooterLink[];
  contactPhone: string;
  contactEmail: string;
  liveChatUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  pinterestUrl: string;
  tiktokUrl: string;
  acceptedPayments: string[];
  currencyLabel: string;
  copyrightText: string;
}

const PAYMENT_OPTIONS = ['mpesa', 'visa', 'mastercard', 'amex', 'paypal', 'paystack', 'airtel', 'diners', 'discover'];

async function fetchSettings(): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/site-settings`, { credentials: 'include' });
  return res.json();
}

export default function AdminFooter() {
  const { data } = useQuery({ queryKey: ['site-settings-admin'], queryFn: fetchSettings });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data);
  }, [data]);

  if (!form) {
    return (
      <AuthGuard requireAdmin>
        <AdminLayout>
          <div className="h-40 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </AdminLayout>
      </AuthGuard>
    );
  }

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const setLink = (list: 'aboutLinks' | 'supportLinks', i: number, key: keyof FooterLink, value: string) => {
    setForm((f) => {
      if (!f) return f;
      const links = f[list].slice();
      links[i] = { ...links[i], [key]: value };
      return { ...f, [list]: links };
    });
  };
  const addLink = (list: 'aboutLinks' | 'supportLinks') =>
    setForm((f) => (f ? { ...f, [list]: [...f[list], { label: '', href: '' }] } : f));
  const removeLink = (list: 'aboutLinks' | 'supportLinks', i: number) =>
    setForm((f) => (f ? { ...f, [list]: f[list].filter((_, idx) => idx !== i) } : f));

  const togglePayment = (key: string) =>
    setForm((f) => {
      if (!f) return f;
      const has = f.acceptedPayments.includes(key);
      return { ...f, acceptedPayments: has ? f.acceptedPayments.filter((k) => k !== key) : [...f.acceptedPayments, key] };
    });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/site-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      await queryClient.invalidateQueries({ queryKey: ['site-settings'] });
      await queryClient.invalidateQueries({ queryKey: ['site-settings-admin'] });
      toast({ title: 'Footer saved', description: 'Your changes are live on the storefront.' });
    } catch (e) {
      toast({ title: 'Failed to save footer', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const LinkEditor = ({ list, heading }: { list: 'aboutLinks' | 'supportLinks'; heading: string }) => (
    <div className="bg-card border rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">{heading}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => addLink(list)}>
          <Plus className="w-4 h-4 mr-1.5" /> Add link
        </Button>
      </div>
      <div className="space-y-2">
        {form[list].length === 0 && <p className="text-sm text-muted-foreground">No links yet.</p>}
        {form[list].map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <Input
              value={link.label}
              placeholder="Label (e.g. FAQ)"
              onChange={(e) => setLink(list, i, 'label', e.target.value)}
              className="flex-1"
            />
            <Input
              value={link.href}
              placeholder="/faq"
              onChange={(e) => setLink(list, i, 'href', e.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive p-2 shrink-0"
              onClick={() => removeLink(list, i)}
              aria-label="Remove link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Footer</h1>
            <p className="text-muted-foreground mt-1">Edit the storefront footer — links, contact, socials and payment badges.</p>
          </div>
          <Button className="font-bold shadow-md shadow-primary/20" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
          {/* Link columns */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Label>“About us” column heading</Label>
              <Input value={form.aboutHeading} onChange={(e) => set('aboutHeading', e.target.value)} />
            </div>
            <LinkEditor list="aboutLinks" heading="About us links" />
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Label>“Customer support” column heading</Label>
              <Input value={form.supportHeading} onChange={(e) => set('supportHeading', e.target.value)} />
            </div>
            <LinkEditor list="supportLinks" heading="Customer support links" />
          </div>

          {/* Get in touch */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold">Get in touch</h3>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+254 700 000 000" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="support@happyfine.co.ke" />
            </div>
            <div className="space-y-2">
              <Label>Live chat URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.liveChatUrl} onChange={(e) => set('liveChatUrl', e.target.value)} placeholder="https://…" />
            </div>
          </div>

          {/* Socials */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold">Follow us <span className="text-muted-foreground font-normal text-sm">(leave blank to hide)</span></h3>
            {(['facebookUrl', 'instagramUrl', 'pinterestUrl', 'tiktokUrl'] as const).map((k) => (
              <div key={k} className="space-y-2">
                <Label className="capitalize">{k.replace('Url', '')}</Label>
                <Input value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder="https://…" />
              </div>
            ))}
          </div>

          {/* Payments + currency */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold">We accept</h3>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_OPTIONS.map((k) => {
                const active = form.acceptedPayments.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => togglePayment(k)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border capitalize transition-colors ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label>Currency label</Label>
              <Input value={form.currencyLabel} onChange={(e) => set('currencyLabel', e.target.value)} placeholder="Kenya (KES)" />
            </div>
          </div>

          {/* Bottom bar */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold">Bottom bar</h3>
            <div className="space-y-2">
              <Label>Copyright name</Label>
              <Input value={form.copyrightText} onChange={(e) => set('copyrightText', e.target.value)} placeholder="Happyfine Wholesalers" />
              <p className="text-xs text-muted-foreground">Rendered as “© {new Date().getFullYear()} {form.copyrightText}. All rights reserved.”</p>
            </div>
            <div className="space-y-2">
              <Label>Short blurb <span className="text-muted-foreground font-normal">(optional, stored for future use)</span></Label>
              <Textarea value={form.brandBlurb} onChange={(e) => set('brandBlurb', e.target.value)} rows={2} />
            </div>
          </div>
        </div>

        <div className="mt-8 max-w-5xl">
          <Button className="font-bold" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
