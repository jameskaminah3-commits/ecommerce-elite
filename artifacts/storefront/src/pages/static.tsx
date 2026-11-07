import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Clock, ShieldCheck, Check } from 'lucide-react';
import { paymentWays } from '@/components/checkout/ManualMpesaPanel';
import { PaymentLogo } from '@/components/layout/PaymentLogos';
import { SiWhatsapp } from 'react-icons/si';
import { useQuery } from '@tanstack/react-query';
import { parsePhones, whatsappHref, whatsappPhone } from '@/lib/contact';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// Shared layout for the footer's info/policy pages.
function ContentPage({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  React.useEffect(() => {
    const prev = document.title;
    document.title = `${title} — Happyfine Wholesalers`;
    return () => { document.title = prev; };
  }, [title]);
  return (
    <StorefrontLayout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2 text-[15px]">{subtitle}</p>}
        </div>
      </div>
      <div className="container mx-auto px-4 py-10 md:py-14 max-w-3xl text-[15px] leading-relaxed text-muted-foreground space-y-4">
        {children}
      </div>
    </StorefrontLayout>
  );
}

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-lg font-bold text-foreground mt-8 mb-1.5">{children}</h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-1.5">{children}</ul>
);

// ── Our story ──────────────────────────────────────────────────────────────
export function AboutPage() {
  return (
    <ContentPage title="Our story" subtitle="Wholesale prices for everyone — no minimum order.">
      <P>Happyfine Wholesalers started with a simple idea: everyday people should be able to buy quality goods at the kind of prices usually reserved for bulk buyers — without having to buy in bulk. We cut out the middlemen and pass the saving on to you. Buy one item or ten: the wholesale price is the price.</P>
      <P>From electronics and home essentials to beauty and fitness, we handpick products that are built to last, and we deliver them straight to your door anywhere in the country.</P>
      <H2>What we stand for</H2>
      <UL>
        <li><strong className="text-foreground">Fair prices</strong> — wholesale pricing for everyone, every day, with no minimum order.</li>
        <li><strong className="text-foreground">Real quality</strong> — every item is checked before it ships.</li>
        <li><strong className="text-foreground">Nationwide delivery</strong> — free on orders over KES 5,000.</li>
        <li><strong className="text-foreground">A team you can reach</strong> — real people in Nairobi, ready to help.</li>
      </UL>
      <div className="pt-4">
        <Button asChild><Link href="/products">Shop the catalogue</Link></Button>
      </div>
    </ContentPage>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
export function FaqPage() {
  const faqs = [
    { q: 'Is there a minimum order?', a: 'No. “Wholesale” describes our prices, not how much you have to buy. You can order a single item and still pay the wholesale price.' },
    { q: 'Why are your prices so low?', a: 'We buy direct from suppliers and cut out the middlemen, then pass the saving on to you. Wholesale pricing applies to every product and every customer — no trade account needed.' },
    { q: 'How do I know I am getting a good price?', a: 'Where we know what a product usually sells for in other shops, we show that price crossed out next to our wholesale price, and your cart tells you how much you are saving.' },
    { q: 'What payment methods can I use?', a: 'M-Pesa (a prompt goes straight to your phone), Airtel Money, or a Visa/Mastercard card — all paid securely online. If the M-Pesa prompt does not reach you, you will be shown how to pay manually and confirm with your M-Pesa code.' },
    { q: 'How much is delivery?', a: 'Delivery is calculated by town at checkout, and it is free on all orders over KES 5,000. You will always see the exact fee before you pay.' },
    { q: 'How long does delivery take?', a: 'Most orders within Nairobi arrive within 1–2 business days. Other towns typically take 2–4 business days, depending on your location.' },
    { q: 'Can I return an item?', a: 'Yes. If something is not right, you can return most items within 7 days. See our Refunds & returns page for the details.' },
    { q: 'How do I track my order?', a: 'Every order has its own status page. You will find the link in your order confirmation and under your account’s order history.' },
  ];
  return (
    <ContentPage title="Frequently asked questions" subtitle="Answers to the things customers ask us most.">
      <div className="divide-y divide-border">
        {faqs.map((f) => (
          <div key={f.q} className="py-5 first:pt-0">
            <h3 className="font-semibold text-foreground mb-1.5">{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
      <P>Still stuck? <Link href="/contact" className="text-primary font-medium hover:underline">Get in touch</Link> and we’ll help.</P>
    </ContentPage>
  );
}

// ── Contact ─────────────────────────────────────────────────────────────────
// Real numbers from Admin › Footer & payments — several phones, WhatsApp and email.
export function ContactPage() {
  const { data } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/site-settings`);
      return r.ok ? r.json() : {};
    },
  });
  const phones = parsePhones(data?.contactPhone);
  const wa = whatsappHref(data, 'Hi Happyfine Wholesalers 👋');
  const email: string | undefined = data?.contactEmail || undefined;
  return (
    <ContentPage title="Contact us" subtitle="We’re a real team in Kenya — happy to help with orders, delivery and returns.">
      <div className="grid sm:grid-cols-2 gap-4 not-prose">
        {phones.length > 0 && (
          <ContactCard icon={<Phone className="w-[18px] h-[18px]" />} label="Call us">
            {phones.map((p) => (
              <a key={p.msisdn} href={`tel:${p.tel}`} className="block font-semibold tabular-nums text-foreground hover:text-primary transition-colors">
                {p.display}
              </a>
            ))}
          </ContactCard>
        )}
        {wa && (
          <ContactCard icon={<SiWhatsapp className="w-[18px] h-[18px]" />} label="WhatsApp" tone="whatsapp">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground hover:text-[#1da851] transition-colors">
              Chat with us{whatsappPhone(data) ? ` · ${whatsappPhone(data)!.display}` : ''}
            </a>
          </ContactCard>
        )}
        {email && (
          <ContactCard icon={<Mail className="w-[18px] h-[18px]" />} label="Email">
            <a href={`mailto:${email}`} className="font-semibold text-foreground hover:text-primary transition-colors break-all">{email}</a>
          </ContactCard>
        )}
        <ContactCard icon={<MapPin className="w-[18px] h-[18px]" />} label="Delivery">
          <p className="font-semibold text-foreground">Across Kenya</p>
        </ContactCard>
        <ContactCard icon={<Clock className="w-[18px] h-[18px]" />} label="Hours">
          <p className="font-semibold text-foreground">Mon–Sat, 8am–6pm</p>
        </ContactCard>
      </div>
      <ContactForm />

      {(wa || email) && (
        <div className="pt-4 flex flex-wrap gap-2">
          {wa && (
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebe5b] text-white">
              <a href={wa} target="_blank" rel="noopener noreferrer"><SiWhatsapp className="w-4 h-4 mr-2" /> Chat on WhatsApp</a>
            </Button>
          )}
          {email && (
            <Button asChild variant="outline"><a href={`mailto:${email}`}>Email our team</a></Button>
          )}
        </div>
      )}
    </ContentPage>
  );
}

// "Send us a message" — goes straight to the shop team's inbox; replies go to the customer.
function ContactForm() {
  const [state, setState] = React.useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = React.useState('');
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('sending');
    setError('');
    try {
      const r = await fetch(`${API_BASE}/api/inquiries/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(f.entries())),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not send your message.');
      setState('sent');
    } catch (err: any) {
      setState('error');
      setError(err?.message || 'Could not send your message.');
    }
  };
  if (state === 'sent') {
    return (
      <div className="not-prose mt-6 rounded-2xl border bg-emerald-50/60 border-emerald-200 p-6 text-center" data-testid="contact-sent">
        <p className="font-semibold text-emerald-900">Thanks — your message is with our team.</p>
        <p className="text-sm text-emerald-800/80 mt-1">We usually reply within a few hours (Mon–Sat).</p>
      </div>
    );
  }
  const field = 'w-full h-12 rounded-xl border bg-background px-4 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
  return (
    <form onSubmit={submit} className="not-prose mt-6 rounded-2xl border bg-card p-5 sm:p-6 space-y-3" data-testid="contact-form">
      <div>
        <h2 className="text-lg font-semibold">Send us a message</h2>
        <p className="text-sm text-muted-foreground">Ask about a product, an order or delivery — we'll get back to you.</p>
      </div>
      <input name="name" required placeholder="Your name" autoComplete="name" aria-label="Your name" className={field} />
      <div className="grid sm:grid-cols-2 gap-3">
        <input name="phone" type="tel" inputMode="tel" placeholder="Phone (e.g. 0712 345 678)" autoComplete="tel" aria-label="Phone" className={field} />
        <input name="email" type="email" inputMode="email" placeholder="Email (optional)" autoComplete="email" aria-label="Email" className={field} />
      </div>
      <textarea name="message" required rows={4} placeholder="How can we help?" aria-label="Message" className={`${field} h-auto py-3 resize-y`} />
      {/* Bots fill this in; people never see it. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state === 'error' && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full h-12 font-bold" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}

function ContactCard({ icon, label, tone, children }: { icon: React.ReactNode; label: string; tone?: 'whatsapp'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border bg-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tone === 'whatsapp' ? 'bg-[#25D366]/10 text-[#1da851]' : 'bg-primary/10 text-primary'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ── Shipping ────────────────────────────────────────────────────────────────
export function ShippingPage() {
  return (
    <ContentPage title="Shipping information" subtitle="How and when your order reaches you.">
      <H2>Where we deliver</H2>
      <P>We deliver across Kenya. Delivery cost depends on your town and is shown at checkout before you pay — there are no surprise fees.</P>
      <H2>Free delivery</H2>
      <P>Orders over <strong className="text-foreground">KES 5,000</strong> ship free, nationwide. Below that, a per-town fee applies.</P>
      <H2>Delivery times</H2>
      <UL>
        <li>Nairobi: 1–2 business days</li>
        <li>Major towns: 2–3 business days</li>
        <li>Other areas: 3–4 business days</li>
      </UL>
      <P>You’ll get a link to track your order’s status from the moment it’s confirmed.</P>
      <H2>Questions?</H2>
      <P>Reach us any time via the <Link href="/contact" className="text-primary font-medium hover:underline">contact page</Link>.</P>
    </ContentPage>
  );
}

// ── Returns ─────────────────────────────────────────────────────────────────
export function ReturnsPage() {
  return (
    <ContentPage title="Refunds & returns" subtitle="Not right? We’ll make it right.">
      <H2>Our promise</H2>
      <P>If an item arrives damaged, faulty, or isn’t what you ordered, you can return it within <strong className="text-foreground">7 days</strong> of delivery for a replacement or refund.</P>
      <H2>What can be returned</H2>
      <UL>
        <li>Items in their original condition and packaging.</li>
        <li>Products that are faulty, damaged in transit, or incorrect.</li>
      </UL>
      <P>For hygiene reasons, some items (such as opened beauty and personal-care products) can’t be returned unless they’re faulty.</P>
      <H2>How to start a return</H2>
      <UL>
        <li>Contact us within 7 days with your order number.</li>
        <li>We’ll confirm the return and arrange collection or drop-off.</li>
        <li>Once we receive the item, refunds are processed within 5–7 business days to your original payment method.</li>
      </UL>
      <div className="pt-3">
        <Button asChild variant="outline"><Link href="/contact">Start a return</Link></Button>
      </div>
    </ContentPage>
  );
}

// ── Terms ───────────────────────────────────────────────────────────────────
export function TermsPage() {
  return (
    <ContentPage title="Terms of use" subtitle="The basics of shopping with Happyfine.">
      <P>By using this website and placing an order, you agree to these terms. Please read them alongside our Privacy Policy.</P>
      <H2>Orders & pricing</H2>
      <P>All prices are shown in Kenyan Shillings (KES) and include applicable taxes unless stated otherwise. We do our best to keep prices and stock accurate; if an error occurs, we’ll contact you before charging or dispatching your order.</P>
      <H2>Payment</H2>
      <P>Orders are confirmed once payment is received (via M-Pesa, Airtel Money or card). Stock is reserved briefly during checkout and released if payment isn’t completed.</P>
      <H2>Delivery</H2>
      <P>Delivery times are estimates. We’re not liable for delays caused by circumstances outside our control, but we’ll always keep you informed.</P>
      <H2>Returns</H2>
      <P>Returns are handled as described on our Refunds & returns page.</P>
      <H2>Contact</H2>
      <P>Questions about these terms? Reach us via the <Link href="/contact" className="text-primary font-medium hover:underline">contact page</Link>.</P>
    </ContentPage>
  );
}

// ── Privacy ─────────────────────────────────────────────────────────────────
export function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy" subtitle="How we handle your information.">
      <P>We respect your privacy and only collect what we need to process your orders and improve your experience.</P>
      <H2>What we collect</H2>
      <UL>
        <li>Contact and delivery details (name, phone, email, address).</li>
        <li>Order and payment status (we never store full card numbers).</li>
        <li>Basic usage data to keep the site fast and secure.</li>
      </UL>
      <H2>How we use it</H2>
      <UL>
        <li>To process, deliver, and support your orders.</li>
        <li>To send order updates and, if you opt in, occasional offers.</li>
        <li>To prevent fraud and keep your account secure.</li>
      </UL>
      <H2>Your choices</H2>
      <P>You can unsubscribe from marketing at any time, and you can ask us to update or delete your personal information by contacting us.</P>
      <H2>Contact</H2>
      <P>For any privacy question, reach us via the <Link href="/contact" className="text-primary font-medium hover:underline">contact page</Link>.</P>
    </ContentPage>
  );
}

// ── Ways to pay ─────────────────────────────────────────────────────────────
// Where the footer's payment badges lead. Built from the live settings, so it only
// ever describes ways to pay that work today (and the shop's real M-PESA details).
export function PaymentsPage() {
  const { data } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/site-settings`);
      return r.ok ? r.json() : {};
    },
  });
  const ways = paymentWays(data);
  const payNow = (data?.manualPaymentMode ?? 'pay_now') === 'pay_now' && ways.length > 0;
  const online = data?.onlinePaymentsAvailable === true;
  const name: string | undefined = data?.mpesaAccountName?.trim()?.toUpperCase() || undefined;
  const wa = whatsappHref(data, 'Hi Happyfine Wholesalers 👋 I’d like to order.');
  const hold = Number(data?.manualHoldHours ?? 24);

  return (
    <ContentPage title="Ways to pay" subtitle="Simple, safe payment in Kenyan Shillings — with M-PESA, the way you already pay.">
      <div className="not-prose space-y-4">
        {/* Lipa na M-PESA */}
        <section id="mpesa" className="scroll-mt-24 rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-emerald-50/50">
            <PaymentLogo kind="mpesa" />
            <div>
              <h2 className="font-semibold text-lg leading-tight">Lipa na M-PESA</h2>
              <p className="text-xs text-muted-foreground">{payNow ? 'Pay from your phone after placing your order' : 'Pay with M-PESA when we confirm your order'}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {payNow ? (
              <>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ways.map((w) => (
                    <div key={w.key} className="rounded-xl border bg-background px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{w.tab}</p>
                      <p className="text-xl font-extrabold tabular-nums tracking-wide">{w.number}</p>
                    </div>
                  ))}
                </div>
                {name && (
                  <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-700" />
                    <span>Registered name: <strong>{name}</strong>. M-PESA shows it before you enter your PIN — only pay if it matches.</span>
                  </p>
                )}
                <ol className="space-y-2 text-sm">
                  {[
                    'Add items to your cart and place your order — choose Lipa na M-PESA.',
                    'Pay the exact amount shown, using the number above.',
                    'Enter the code from your M-PESA SMS on your order page.',
                    'We confirm your payment and dispatch your order.',
                  ].map((t, i) => (
                    <li key={t} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="pt-0.5">{t}</span>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">Your items are reserved for {hold} hours while you pay.</p>
              </>
            ) : (
              <ol className="space-y-2 text-sm">
                {['Place your order — nothing to pay yet.', 'We call you to confirm your order and delivery.', 'You pay with M-PESA, then we dispatch.'].map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Instant online payment — only while it's switched on */}
        {online && (
          <>
            <section id="airtel" className="scroll-mt-24 rounded-2xl border bg-card p-5 flex items-start gap-4">
              <PaymentLogo kind="airtel" />
              <div>
                <h2 className="font-semibold text-lg leading-tight">M-PESA prompt &amp; Airtel Money</h2>
                <p className="text-sm text-muted-foreground mt-1">Choose it at checkout and approve the payment prompt on your phone with your PIN. Confirmed instantly.</p>
              </div>
            </section>
            <section id="card" className="scroll-mt-24 rounded-2xl border bg-card p-5 flex items-start gap-4">
              <div className="flex gap-1.5 shrink-0"><PaymentLogo kind="visa" /><PaymentLogo kind="mastercard" /></div>
              <div>
                <h2 className="font-semibold text-lg leading-tight">Visa &amp; Mastercard</h2>
                <p className="text-sm text-muted-foreground mt-1">Pay by card on a secure checkout page. Your card details never touch our servers.</p>
              </div>
            </section>
          </>
        )}

        {/* WhatsApp */}
        {wa && (
          <section id="whatsapp" className="scroll-mt-24 rounded-2xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="w-11 h-11 rounded-xl bg-[#25D366]/10 text-[#1da851] flex items-center justify-center shrink-0"><SiWhatsapp className="w-6 h-6" /></span>
            <div className="flex-1">
              <h2 className="font-semibold text-lg leading-tight">Prefer to chat? Order on WhatsApp</h2>
              <p className="text-sm text-muted-foreground mt-1">Send us what you’d like — we confirm stock, delivery and payment with you in the chat.</p>
            </div>
            <Button asChild className="bg-[#25D366] hover:bg-[#1ebe5b] text-white shrink-0">
              <a href={wa} target="_blank" rel="noopener noreferrer"><SiWhatsapp className="w-4 h-4 mr-2" /> Chat on WhatsApp</a>
            </Button>
          </section>
        )}

        {/* Reassurance */}
        <section className="grid sm:grid-cols-3 gap-3">
          {[
            { t: 'Kenyan Shillings only', d: 'Every price is in KES. No conversion, no hidden fees.' },
            { t: 'Pay only what you see', d: 'Item prices plus the delivery fee for your town, shown before you order.' },
            { t: 'Every payment confirmed', d: 'We check each payment and send you a confirmation before dispatch.' },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border bg-muted/30 p-4">
              <p className="font-semibold text-sm flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" /> {x.t}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </section>

        <div className="pt-2">
          <Button asChild size="lg" className="w-full sm:w-auto h-12 font-bold">
            <Link href="/products">Start shopping</Link>
          </Button>
        </div>
      </div>
    </ContentPage>
  );
}
