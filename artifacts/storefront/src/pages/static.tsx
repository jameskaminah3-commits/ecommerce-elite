import React from 'react';
import { StorefrontLayout } from '@/components/layout/StorefrontLayout';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

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
    <ContentPage title="Our story" subtitle="Wholesale prices, delivered across Kenya.">
      <P>Happyfine Wholesalers started with a simple idea: everyday people should be able to buy quality goods at the kind of prices usually reserved for bulk buyers. We cut out the middlemen and pass the saving on to you.</P>
      <P>From electronics and home essentials to beauty and fitness, we handpick products that are built to last, and we deliver them straight to your door anywhere in the country.</P>
      <H2>What we stand for</H2>
      <UL>
        <li><strong className="text-foreground">Fair prices</strong> — wholesale pricing for everyone, every day.</li>
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
    { q: 'How much is delivery?', a: 'Delivery is calculated by town at checkout, and it is free on all orders over KES 5,000. You will always see the exact fee before you pay.' },
    { q: 'How long does delivery take?', a: 'Most orders within Nairobi arrive within 1–2 business days. Other towns typically take 2–4 business days, depending on your location.' },
    { q: 'What payment methods can I use?', a: 'You can pay with M-Pesa (STK push straight to your phone) or with a debit/credit card. Cash on delivery is available in selected areas.' },
    { q: 'Are the “wholesale prices” only for shops?', a: 'No. Our wholesale prices are for everyone — you do not need a business to shop with us.' },
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
export function ContactPage() {
  return (
    <ContentPage title="Contact us" subtitle="We’re a real team in Nairobi — happy to help.">
      <div className="grid sm:grid-cols-2 gap-4 not-prose">
        {[
          { icon: Phone, label: 'Call or WhatsApp', value: '+254 700 000 000', href: 'tel:+254700000000' },
          { icon: Mail, label: 'Email', value: 'support@happyfine.co.ke', href: 'mailto:support@happyfine.co.ke' },
          { icon: MapPin, label: 'Location', value: 'Nairobi, Kenya', href: undefined },
          { icon: Clock, label: 'Hours', value: 'Mon–Sat, 8am–6pm', href: undefined },
        ].map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-start gap-3 p-4 rounded-xl border bg-card">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              {href ? (
                <a href={href} className="font-semibold text-foreground hover:text-primary transition-colors">{value}</a>
              ) : (
                <p className="font-semibold text-foreground">{value}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="pt-4">
        <Button asChild><a href="mailto:support@happyfine.co.ke">Email our team</a></Button>
      </div>
    </ContentPage>
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
      <P>Orders are confirmed once payment is received (via M-Pesa or card) or, where offered, arranged as cash on delivery. Stock is reserved briefly during checkout and released if payment isn’t completed.</P>
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
