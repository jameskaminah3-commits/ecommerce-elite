import React, { useState } from 'react';
import { Check, ChevronRight, Copy, Lock, MessageCircle, Phone, ShieldCheck, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, classNames } from '@/lib/utils';
import { parsePhones, whatsappHref } from '@/lib/contact';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface MpesaDetails {
  mpesaPochiPhone?: string;
  mpesaPaybill?: string;
  mpesaTill?: string;
  mpesaAccountName?: string;
  mpesaSendPhone?: string;
  mpesaInstructions?: string;
  contactPhone?: string;
  liveChatUrl?: string;
  whatsappNumber?: string;
  manualHoldHours?: number;
}

const holdText = (s?: MpesaDetails | null) => {
  const h = s?.manualHoldHours ?? 24;
  return h % 24 === 0 && h >= 48 ? `${h / 24} days` : `${h} hour${h === 1 ? '' : 's'}`;
};

export function hasMpesaDetails(s?: MpesaDetails | null): boolean {
  return Boolean(s && (s.mpesaPochiPhone || s.mpesaPaybill || s.mpesaTill || s.mpesaSendPhone));
}

type WayKey = 'pochi' | 'till' | 'paybill' | 'send';

interface Way {
  key: WayKey;
  tab: string;
  numberLabel: string;
  number: string;
  path: string[];
  account?: string;
}

// The ways to pay the shop, in the order a Kenyan shopper expects them, with the
// exact Safaricom M-PESA menu path for each.
export function paymentWays(s: MpesaDetails | null | undefined, orderId?: number): Way[] {
  if (!s) return [];
  const ways: Way[] = [];
  const pochi = s.mpesaPochiPhone?.trim();
  const till = s.mpesaTill?.trim();
  const paybill = s.mpesaPaybill?.trim();
  const send = s.mpesaSendPhone?.trim();
  if (pochi) ways.push({ key: 'pochi', tab: 'Pochi la Biashara', numberLabel: 'Pochi la Biashara number', number: pochi, path: ['Lipa na M-PESA', 'Pochi la Biashara'] });
  if (till) ways.push({ key: 'till', tab: 'Till', numberLabel: 'Till number', number: till, path: ['Lipa na M-PESA', 'Buy Goods and Services'] });
  if (paybill)
    ways.push({
      key: 'paybill',
      tab: 'Paybill',
      numberLabel: 'Business number',
      number: paybill,
      path: ['Lipa na M-PESA', 'Pay Bill'],
      account: orderId ? String(orderId) : undefined,
    });
  if (send) ways.push({ key: 'send', tab: 'Send Money', numberLabel: 'Phone number', number: send, path: ['Send Money'] });
  return ways;
}

// The Safaricom-style "M-PESA" wordmark chip, so the card reads as M-Pesa at a glance.
export function MpesaMark({ className = '' }: { className?: string }) {
  return (
    <span className={classNames('inline-flex shrink-0 items-center whitespace-nowrap rounded-md bg-[#3bb54a] px-1.5 py-0.5 text-[11px] font-black tracking-tight text-white', className)}>
      M-PESA
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border bg-background text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition shrink-0"
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
      {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Steps({ way, amount, name }: { way: Way; amount: number; name?: string }) {
  const steps: React.ReactNode[] = [
    <>Open <strong>M-PESA</strong> on your phone (SIM menu or the M-PESA app).</>,
    <span className="inline-flex flex-wrap items-center gap-x-1">
      {way.path.map((p, i) => (
        <React.Fragment key={p}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <strong>{p}</strong>
        </React.Fragment>
      ))}
    </span>,
    <>
      Enter {way.key === 'till' ? 'Till number' : way.key === 'paybill' ? 'Business number' : 'phone number'}{' '}
      <strong className="tabular-nums">{way.number}</strong>
      {way.account && (
        <>
          , then Account number <strong className="tabular-nums">{way.account}</strong>
        </>
      )}
    </>,
    <>Enter amount <strong className="tabular-nums">{formatCurrency(amount)}</strong></>,
    <>
      Enter your PIN
      {name ? (
        <>
          {' '}— check the name shows <strong>{name}</strong>
        </>
      ) : null}
      , then send.
    </>,
  ];
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm leading-snug">
          <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
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
 * Lipa na M-PESA, the way a shop counter does it: our business number and name,
 * the exact menu steps on the customer's phone, then the M-PESA code from the SMS.
 * The team matches the code against the M-PESA statement and confirms the order.
 */
export function ManualMpesaPanel({ settings, orderId, amount, onSubmitted }: Props) {
  const { toast } = useToast();
  const ways = paymentWays(settings, orderId);
  const [active, setActive] = useState<WayKey | null>(null);
  const way = ways.find((w) => w.key === active) ?? ways[0];
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = settings?.mpesaAccountName?.trim().toUpperCase() || undefined;

  if (!way) return null;

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
      toast({ title: 'Payment code received', description: "We're confirming your M-PESA payment." });
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.message || 'Could not submit the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border bg-card text-left shadow-sm overflow-hidden" data-testid="manual-mpesa-panel">
      {/* Header: what to pay, to whom */}
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b bg-emerald-50/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MpesaMark />
            <span className="text-sm font-semibold text-foreground">Lipa na M-PESA</span>
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground">Order #{orderId}</span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount to pay</p>
        <p className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground">{formatCurrency(amount)}</p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {ways.length > 1 && (
          <div role="tablist" aria-label="How to pay" className="flex gap-1 rounded-full bg-muted p-1 overflow-x-auto">
            {ways.map((w) => (
              <button
                key={w.key}
                role="tab"
                type="button"
                aria-selected={w.key === way.key}
                onClick={() => setActive(w.key)}
                className={classNames(
                  'flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  w.key === way.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {w.tab}
              </button>
            ))}
          </div>
        )}

        {/* The "sticker on the counter": number + registered business name */}
        <div className="rounded-xl border bg-background p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{way.numberLabel}</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-2xl font-extrabold tabular-nums tracking-wide break-all">{way.number}</p>
            <CopyButton value={way.number.replace(/\s+/g, '')} label={way.numberLabel} />
          </div>
          {way.account && (
            <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Account number</p>
                <p className="text-lg font-bold tabular-nums">{way.account}</p>
              </div>
              <CopyButton value={way.account} label="account number" />
            </div>
          )}
          {name && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>
                Registered name: <strong>{name}</strong>. M-PESA shows it before you enter your PIN — only pay if it matches.
              </span>
            </p>
          )}
        </div>

        <Steps way={way} amount={amount} name={name} />

        {settings?.mpesaInstructions && <p className="text-xs text-muted-foreground">{settings.mpesaInstructions}</p>}

        {/* After paying: the code from the SMS */}
        <form onSubmit={submit} className="rounded-xl border border-dashed p-4 space-y-2.5">
          <label htmlFor="mpesa-code" className="block text-sm font-semibold">
            Paid? Enter the M-PESA code from your SMS
          </label>
          <div className="flex gap-2">
            <Input
              id="mpesa-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="e.g. SGH7XK9QPM"
              aria-label="M-Pesa confirmation code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="h-12 bg-background font-mono text-base tracking-wider"
            />
            <Button type="submit" className="h-12 shrink-0 font-bold px-5 bg-[#2e9e3d] hover:bg-[#278a34] text-white" disabled={busy || !code.trim()}>
              {busy ? 'Sending…' : 'Confirm'}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-px" />
            We match your code with our M-PESA statement, then confirm and dispatch your order. You'll get a confirmation.
          </p>
        </form>

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="w-3.5 h-3.5 shrink-0" />
          Your items are reserved for you for {holdText(settings)}.
        </p>
      </div>
    </div>
  );
}

/**
 * Before the shop has published a payment number: a phone order, the way many
 * Kenyan shops already sell — we call to confirm, then the customer pays by M-PESA.
 */
export function ConfirmByCallPanel({
  settings,
  orderId,
  amount,
  customerPhone,
}: {
  settings?: MpesaDetails | null;
  orderId: number;
  amount: number;
  customerPhone?: string | null;
}) {
  const wa = whatsappHref(settings, `Hi, I've just placed order #${orderId}.`);
  const phone = parsePhones(settings?.contactPhone)[0];
  const steps = [
    <>We call you{customerPhone ? <> on <strong className="tabular-nums">{customerPhone}</strong></> : null} to confirm your order and delivery.</>,
    <>You pay <strong className="tabular-nums">{formatCurrency(amount)}</strong> with M-PESA — we share our business details on the call.</>,
    <>We dispatch your order and send you a confirmation.</>,
  ];
  return (
    <div className="rounded-2xl border bg-card text-left shadow-sm overflow-hidden" data-testid="confirm-call-panel">
      <div className="px-4 sm:px-5 pt-4 pb-3 border-b bg-emerald-50/50">
        <div className="flex items-center gap-2">
          <MpesaMark />
          <span className="text-sm font-semibold">Pay with M-PESA on confirmation</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Your order is reserved. Here's what happens next:</p>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-snug">
              <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        {(phone || wa) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {phone && (
              <Button asChild variant="outline" className="h-11 font-semibold">
                <a href={`tel:${phone.tel}`}>
                  <Phone className="w-4 h-4 mr-2" /> Call {phone.display}
                </a>
              </Button>
            )}
            {wa && (
              <Button asChild className="h-11 font-semibold bg-[#25d366] hover:bg-[#1ebe5b] text-white">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp us
                </a>
              </Button>
            )}
          </div>
        )}
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="w-3.5 h-3.5 shrink-0" />
          Your items are reserved for you for {holdText(settings)}.
        </p>
      </div>
    </div>
  );
}
