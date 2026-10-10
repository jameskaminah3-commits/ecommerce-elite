import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, Mail, CheckCircle2, AlertTriangle } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

interface Subscriber {
  id: number;
  email: string;
  code: string | null;
  discountPercent: number;
  expiresAt: string | null;
  usedAt: string | null;
  usedOrderId: number | null;
  unsubscribed: boolean;
  createdAt: string;
}
interface SubscriberList {
  items: Subscriber[];
  total: number;
  active: number;
  codesUsed: number;
  emailConfigured: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });

function codeStatus(s: Subscriber): { label: string; tone: string } {
  if (!s.code) return { label: 'No code', tone: 'bg-muted text-muted-foreground' };
  if (s.usedAt) return { label: `Used${s.usedOrderId ? ` · #${s.usedOrderId}` : ''}`, tone: 'bg-emerald-100 text-emerald-700' };
  if (s.expiresAt && new Date(s.expiresAt).getTime() < Date.now()) return { label: 'Expired', tone: 'bg-muted text-muted-foreground' };
  return { label: 'Unused', tone: 'bg-amber-100 text-amber-800' };
}

// Everyone who joined the newsletter, their welcome code and whether it turned into an order.
export default function AdminSubscribers() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery<SubscriberList>({
    queryKey: ['admin', 'subscribers'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/admin/subscribers`, { credentials: 'include' });
      if (!r.ok) throw new Error('Failed to load subscribers');
      return r.json();
    },
  });
  const items = useMemo(
    () => (data?.items ?? []).filter((s) => !q || s.email.includes(q.toLowerCase()) || (s.code ?? '').includes(q.toUpperCase())),
    [data, q],
  );
  const conversion = data && data.total > 0 ? Math.round((data.codesUsed / data.total) * 100) : 0;

  return (
    <AuthGuard requireAdmin>
      <AdminLayout>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscribers</h1>
            <p className="text-muted-foreground mt-1">People who joined your list, and their first-order welcome codes.</p>
          </div>
          <Button asChild variant="outline">
            <a href={`${API_BASE}/api/admin/subscribers?format=csv`}>
              <Download className="w-4 h-4 mr-2" /> Export CSV
            </a>
          </Button>
        </div>

        {data && !data.emailConfigured && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Email sending isn’t connected yet, so welcome codes are only shown on screen. Add <strong>RESEND_API_KEY</strong> and{' '}
              <strong>RESEND_FROM</strong> in Railway → Variables to email codes and order updates.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Subscribers', value: data?.active ?? '—' },
            { label: 'Codes used', value: data?.codesUsed ?? '—' },
            { label: 'Became buyers', value: data ? `${conversion}%` : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/10 flex items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search email or code…" className="pl-9 bg-background" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Link href="/admin/footer" className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">Welcome offer settings</Link>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No subscribers yet. The signup form is on the homepage.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((s) => {
                const st = codeStatus(s);
                return (
                  <li key={s.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{s.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {fmt(s.createdAt)}
                        {s.unsubscribed && <span className="ml-2 text-destructive font-semibold">· Unsubscribed</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.code && <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{s.code}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${st.tone}`}>
                        {s.usedAt && <CheckCircle2 className="w-3 h-3" />}
                        {st.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AdminLayout>
    </AuthGuard>
  );
}
