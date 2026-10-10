import React, { useState } from 'react';
import { Check, Copy, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface MpesaDetails {
  mpesaPaybill?: string;
  mpesaTill?: string;
  mpesaAccountName?: string;
  mpesaSendPhone?: string;
  mpesaInstructions?: string;
}

export function hasMpesaDetails(s?: MpesaDetails | null): boolean {
  return Boolean(s && (s.mpesaPaybill || s.mpesaTill || s.mpesaSendPhone));
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md border bg-background text-muted-foreground hover:text-foreground active:scale-95 transition shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable — the number is still visible */
        }
      }}
    >
      {done ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function Row({ title, value, sub, copy }: { title: string; value: string; sub?: string; copy?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-lg font-extrabold tabular-nums leading-tight break-all">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {copy && <CopyButton value={copy} label={title} />}
    </div>
  );
}

interface Props {
  settings?: MpesaDetails | null;
  orderId: number;
  amount: number;
  /** Called after the server accepts the code. */
  onSubmitted?: () => void;
}

/**
 * Pay-by-M-Pesa-yourself instructions + the form where the customer enters the
 * confirmation code from the SMS. The shop team verifies it and confirms the order.
 */
export function ManualMpesaPanel({ settings, orderId, amount, onSubmitted }: Props) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const phone = settings?.mpesaSendPhone?.trim();
  const till = settings?.mpesaTill?.trim();
  const paybill = settings?.mpesaPaybill?.trim();
  const name = settings?.mpesaAccountName?.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/payment-reference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reference: code.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Could not submit the code. Please try again.');
      }
      toast({ title: 'Payment code received', description: "We'll confirm your M-Pesa payment shortly." });
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.message || 'Could not submit the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-emerald-200 bg-emerald-50/60 rounded-xl p-4 sm:p-5 text-left" data-testid="manual-mpesa-panel">
      <p className="font-bold text-emerald-800 flex items-center gap-2 mb-1">
        <Smartphone className="w-5 h-5" /> Pay {formatCurrency(amount)} with M-Pesa
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        Follow the steps, then enter the confirmation code from the M-Pesa SMS. We'll verify it and confirm your order.
      </p>

      <ol className="space-y-2.5 mb-4 text-sm">
        <li className="flex gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
          <span>Open <strong>M-Pesa</strong> on your phone and choose the option below.</span>
        </li>
      </ol>

      <div className="space-y-2 mb-4">
        {phone && <Row title="Send Money to" value={phone} sub={name ? `Name: ${name}` : undefined} copy={phone.replace(/\s+/g, '')} />}
        {till && <Row title="Buy Goods — Till number" value={till} sub={name ? `Name: ${name}` : undefined} copy={till} />}
        {paybill && (
          <Row
            title="Pay Bill — Business number"
            value={paybill}
            sub={`Account number: ${name || `Order #${orderId}`}`}
            copy={paybill}
          />
        )}
        <Row title="Amount" value={formatCurrency(amount)} copy={String(Math.round(amount))} />
      </div>

      <ol className="space-y-2.5 mb-4 text-sm" start={2}>
        <li className="flex gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
          <span>
            Enter your M-Pesa PIN. {phone || till ? <>Add <strong>Order #{orderId}</strong> as the reference if asked.</> : null}
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
          <span>Type the code from the SMS below (10 letters &amp; numbers, e.g. <span className="font-mono">SGH7XK9QPM</span>).</span>
        </li>
      </ol>

      {settings?.mpesaInstructions && <p className="text-xs text-muted-foreground mb-3">{settings.mpesaInstructions}</p>}

      <form onSubmit={submit} className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError('');
            }}
            placeholder="M-Pesa code"
            aria-label="M-Pesa confirmation code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="h-12 bg-background font-mono text-base tracking-wider"
          />
          <Button type="submit" className="h-12 shrink-0 font-bold px-5" disabled={busy || !code.trim()}>
            {busy ? 'Sending…' : "I've paid"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
