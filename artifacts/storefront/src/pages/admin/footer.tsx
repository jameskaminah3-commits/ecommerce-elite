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
import { parsePhones } from '@/lib/contact';

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
  whatsappNumber: string;
  googleSiteVerification: string;
  facebookUrl: string;
  instagramUrl: string;
  pinterestUrl: string;
  tiktokUrl: string;
  acceptedPayments: string[];
  currencyLabel: string;
  copyrightText: string;
  mpesaPaybill: string;
  mpesaTill: string;
  mpesaAccountName: string;
  mpesaSendPhone: string;
  mpesaPochiPhone: string;
  mpesaInstructions: string;
  onlinePaymentsEnabled: boolean;
  onlinePaymentsAvailable?: boolean;
  manualMpesaAvailable?: boolean;
  orderNotifyEmails: string;
  referralEnabled: boolean;
  referralDiscountPercent: number;
}

const PAYMENT_OPTIONS = ['mpesa', 'visa', 'mastercard', 'amex', 'paypal', 'airtel', 'diners', 'discover'];

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
            <h1 className="text-3xl font-bold tracking-tight">Footer &amp; payments</h1>
            <p className="text-muted-foreground mt-1">Footer content, M-Pesa manual payment details, and the referral promotion.</p>
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
              <Label>Phone number(s)</Label>
              <Input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="0719 627 868 / 0740 478 464" inputMode="tel" />
              {parsePhones(form.contactPhone).length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Shown as: {parsePhones(form.contactPhone).map((p) => p.display).join('  ·  ')}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Separate several numbers with “/”. Each becomes its own tap-to-call link.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>WhatsApp number</Label>
              <Input value={form.whatsappNumber || ''} onChange={(e) => set('whatsappNumber', e.target.value)} placeholder={parsePhones(form.contactPhone)[0]?.display || 'e.g. 0719 627 868'} inputMode="tel" />
              <p className="text-xs text-muted-foreground">
                Powers “Chat on WhatsApp” in the footer, contact page and the green chat button. Leave blank to use your first phone number.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="support@happyfine.co.ke" />
            </div>
            <div className="space-y-2">
              <Label>Other live chat link <span className="text-muted-foreground font-normal">(optional, e.g. Messenger)</span></Label>
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

          {/* Lipa na M-PESA (manual) */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold">Lipa na M-PESA</h3>
              <p className="text-xs text-muted-foreground mt-1">
                How customers pay you directly, like at the shop counter. They pay on their phone, enter the M-PESA code on their order,
                and you confirm it in <strong>Orders</strong> (Mark paid). Add the ones you use — customers see them at checkout.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Pochi la Biashara number</Label>
              <Input value={form.mpesaPochiPhone || ''} onChange={(e) => set('mpesaPochiPhone', e.target.value)} placeholder="e.g. 0740 478 464" inputMode="tel" />
              <p className="text-xs text-muted-foreground">Customers pay via Lipa na M-PESA › Pochi la Biashara and see your business name before entering their PIN.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buy Goods Till <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={form.mpesaTill || ''} onChange={(e) => set('mpesaTill', e.target.value)} placeholder="e.g. 5203012" inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label>Pay Bill number <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={form.mpesaPaybill || ''} onChange={(e) => set('mpesaPaybill', e.target.value)} placeholder="e.g. 247247" inputMode="numeric" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Send Money number <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={form.mpesaSendPhone || ''} onChange={(e) => set('mpesaSendPhone', e.target.value)} placeholder="e.g. 0712 345 678" inputMode="tel" />
            </div>
            <div className="space-y-2">
              <Label>Registered M-PESA name</Label>
              <Input value={form.mpesaAccountName || ''} onChange={(e) => set('mpesaAccountName', e.target.value)} placeholder="e.g. Happyfine Wholesalers" />
              <p className="text-xs text-muted-foreground">Exactly as M-PESA shows it, so customers can check it before paying — this builds trust.</p>
            </div>
            <div className="space-y-2">
              <Label>Extra note for customers <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={form.mpesaInstructions || ''} onChange={(e) => set('mpesaInstructions', e.target.value)} rows={2} placeholder="e.g. Payments are confirmed 8am–8pm, Monday to Saturday." />
            </div>
            {!form.mpesaPochiPhone && !form.mpesaTill && !form.mpesaPaybill && !form.mpesaSendPhone && (
              <p className="text-xs rounded-md bg-muted px-3 py-2 text-muted-foreground">
                Until you add one, customers can still order — checkout offers “M-PESA on confirmation” and you get an email to call them.
              </p>
            )}
          </div>

          {/* Online payments switch + order emails */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold">Online payments &amp; order emails</h3>
              <p className="text-xs text-muted-foreground mt-1">Control which payment options customers see, and who gets an email for each new order.</p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.onlinePaymentsEnabled}
                onChange={(e) => set('onlinePaymentsEnabled', e.target.checked)}
                className="w-4 h-4 accent-primary mt-0.5"
              />
              <span className="text-sm">
                <span className="font-medium">Offer instant payment (M-Pesa prompt, Airtel Money, card)</span>
                <span className="block text-xs text-muted-foreground">Turn off to take payments by manual M-Pesa only, e.g. while the payment gateway is being set up.</span>
              </span>
            </label>
            {form.onlinePaymentsEnabled && form.onlinePaymentsAvailable === false && (
              <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2">
                Enabled, but the payment gateway isn't connected on the server yet, so customers won't see these options.
              </p>
            )}
            <div className="space-y-2">
              <Label>Order notification emails</Label>
              <Input
                value={form.orderNotifyEmails || ''}
                onChange={(e) => set('orderNotifyEmails', e.target.value)}
                placeholder="owner@example.com, team@example.com"
                inputMode="email"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. These addresses are emailed for every new order and whenever a customer submits an M-Pesa code to verify.
              </p>
            </div>
          </div>

          {/* Google Search */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold">Google Search</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Prove to Google that you own the shop so you can submit your sitemap and see how people find you.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Search Console verification code</Label>
              <Input
                value={form.googleSiteVerification || ''}
                onChange={(e) => set('googleSiteVerification', e.target.value)}
                placeholder='Paste the code or the whole <meta name="google-site-verification" …> tag'
              />
              <p className="text-xs text-muted-foreground">
                In Search Console choose <strong>URL prefix</strong> › <strong>HTML tag</strong>, paste it here, save, then click Verify.
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <p className="text-muted-foreground">Your sitemap (submit this in Search Console › Sitemaps):</p>
              <p className="font-mono break-all text-foreground mt-0.5">{typeof window !== 'undefined' ? `${window.location.origin}/sitemap.xml` : '/sitemap.xml'}</p>
            </div>
          </div>

          {/* Referral promotion */}
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold">Referral promotion</h3>
              <p className="text-xs text-muted-foreground mt-1">Customers share a link; their friend gets a discount on their first order.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.referralEnabled}
                onChange={(e) => set('referralEnabled', e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-medium">Enable referral discounts</span>
            </label>
            <div className="space-y-2">
              <Label>Friend's first-order discount (%)</Label>
              <Input
                type="number"
                min="0"
                max="90"
                value={String(form.referralDiscountPercent ?? 0)}
                onChange={(e) => set('referralDiscountPercent', Math.min(90, Math.max(0, Number(e.target.value) || 0)))}
                placeholder="e.g. 10"
              />
              <p className="text-xs text-muted-foreground">0 turns the promotion off even if enabled.</p>
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
