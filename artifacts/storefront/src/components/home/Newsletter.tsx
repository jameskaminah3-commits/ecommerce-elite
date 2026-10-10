import React, { useState } from 'react';
import { ArrowRight, Check, Copy, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// Remembered so checkout can offer to apply it automatically.
export const WELCOME_CODE_KEY = 'welcomeCode';

interface SignupResult {
  code: string | null;
  percent: number;
  expiresAt: string | null;
  alreadySubscribed: boolean;
  codeUsed: boolean;
  email: string;
}

export function Newsletter() {
  const { data: settings } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/site-settings`);
      return r.ok ? r.json() : {};
    },
  });
  // The promise on the page always matches what the shop actually gives.
  const percent: number = Math.max(0, Number(settings?.welcomeDiscountPercent ?? 0));

  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<SignupResult | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }
      if (data.code) {
        try { localStorage.setItem(WELCOME_CODE_KEY, data.code); } catch { /* private mode */ }
      }
      setResult({ ...data, email: email.trim() });
      setState('done');
      setEmail('');
    } catch {
      setState('error');
      setMessage('Could not reach the server. Please try again.');
    }
  };

  const copy = async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* still visible */ }
  };

  const until = result?.expiresAt
    ? new Date(result.expiresAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'long' })
    : null;

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="panel-sand rounded-3xl px-6 py-12 md:py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Join the list</p>

          {state === 'done' && result ? (
            result.code ? (
              <div className="max-w-md mx-auto" data-testid="welcome-code">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                  {result.alreadySubscribed ? 'Welcome back — here’s your code' : 'You’re in! Here’s your code'}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">
                  {result.percent}% off your first order{until ? `, valid until ${until}` : ''}. We’ve also sent it to{' '}
                  <span className="font-medium text-foreground">{result.email}</span>.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-background px-4 py-3">
                  <span className="font-mono text-xl md:text-2xl font-extrabold tracking-wider">{result.code}</span>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-xs font-semibold hover:bg-muted transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-3">It’s applied automatically at checkout on this device.</p>
                <Link
                  href="/products"
                  className="mt-6 h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors"
                >
                  Start shopping <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
                  {result.alreadySubscribed ? 'You’re already on the list' : 'You’re in!'}
                </h2>
                <p className="text-muted-foreground text-sm inline-flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {result.codeUsed
                    ? 'Your welcome code has already been used — thanks for shopping with us!'
                    : 'We’ll send you deals and new arrivals.'}
                </p>
              </div>
            )
          ) : (
            <>
              <h2 className="text-2xl md:text-4xl font-semibold tracking-tight mb-3">
                {percent > 0 ? (
                  <>
                    Save {percent}% on your <span className="serif-accent">first order</span>
                  </>
                ) : (
                  <>
                    Deals &amp; new arrivals, <span className="serif-accent">first</span>
                  </>
                )}
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-sm md:text-base">
                {percent > 0
                  ? `Join the list for deals and new arrivals — get a ${percent}% code for your first order instantly.`
                  : 'Join the list and be first to hear about deals and new arrivals at wholesale prices.'}
              </p>
              <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  aria-label="Email address"
                  autoComplete="email"
                  className="flex-1 h-12 px-4 rounded-full bg-background border border-border/70 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={state === 'loading'}
                  className="h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
                >
                  {state === 'loading' ? 'Signing up…' : percent > 0 ? <>Get my {percent}% code <ArrowRight className="w-4 h-4" /></> : <>Subscribe <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
              <p className="text-[11px] text-muted-foreground mt-3">No spam. Unsubscribe any time.</p>
            </>
          )}
          {state === 'error' && <p className="text-destructive text-sm mt-3">{message}</p>}
        </div>
      </div>
    </section>
  );
}
