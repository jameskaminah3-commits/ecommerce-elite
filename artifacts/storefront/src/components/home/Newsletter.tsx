import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setState('done');
      setEmail('');
    } catch {
      setState('error');
      setMessage('Could not reach the server. Please try again.');
    }
  };

  return (
    <section className="py-16 md:py-20">
      <div className="container mx-auto px-4">
        <div className="panel-sand rounded-3xl px-6 py-12 md:py-16 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-3">Join the list</p>
          <h2 className="text-2xl md:text-4xl font-semibold tracking-tight mb-3">
            Save 10% on your <span className="serif-accent">first order</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8 text-sm md:text-base">
            Sign up for wholesale deals and new-stock alerts — we'll send a 10% code for your first purchase.
          </p>

          {state === 'done' ? (
            <div className="inline-flex items-center gap-2 text-secondary font-semibold">
              <span className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
              You're in — check your inbox for the code.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 h-12 px-4 rounded-full bg-background border border-border/70 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <button
                type="submit"
                disabled={state === 'loading'}
                className="h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
              >
                {state === 'loading' ? 'Signing up…' : <>Subscribe <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
          {state === 'error' && <p className="text-destructive text-sm mt-3">{message}</p>}
        </div>
      </div>
    </section>
  );
}
