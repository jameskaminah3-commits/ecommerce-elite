import React from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Phone, Mail, MessageCircle, ChevronDown } from 'lucide-react';

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

// Fallback so the footer looks complete even before the API responds.
const FALLBACK: SiteSettings = {
  brandBlurb: "Wholesale prices, delivered across Kenya.",
  aboutHeading: 'About us',
  aboutLinks: [
    { label: 'Our story', href: '/' },
    { label: 'FAQ', href: '/faq' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact', href: '/contact' },
  ],
  supportHeading: 'Customer support',
  supportLinks: [
    { label: 'Shipping info', href: '/shipping' },
    { label: 'Refunds & returns', href: '/returns' },
    { label: 'Terms & conditions', href: '/terms' },
  ],
  contactPhone: '+254 700 000 000',
  contactEmail: 'support@happyfine.co.ke',
  liveChatUrl: '',
  facebookUrl: '', instagramUrl: '', pinterestUrl: '', tiktokUrl: '',
  acceptedPayments: ['mpesa', 'visa', 'mastercard', 'paystack'],
  currencyLabel: 'Kenya (KES)',
  copyrightText: 'Happyfine Wholesalers',
};

async function fetchSettings(): Promise<SiteSettings> {
  const res = await fetch(`${API_BASE}/api/site-settings`);
  if (!res.ok) return FALLBACK;
  return res.json();
}

// Payment badge presentation, keyed by the stored slug.
const PAYMENT_BADGES: Record<string, { label: string; color: string }> = {
  mpesa: { label: 'M-PESA', color: '#37A000' },
  visa: { label: 'VISA', color: '#1A1F71' },
  mastercard: { label: 'Mastercard', color: '#EB001B' },
  amex: { label: 'AMEX', color: '#2E77BC' },
  paypal: { label: 'PayPal', color: '#003087' },
  paystack: { label: 'Paystack', color: '#011B33' },
  airtel: { label: 'Airtel Money', color: '#E40000' },
  diners: { label: 'Diners', color: '#0079BE' },
  discover: { label: 'Discover', color: '#FF6000' },
};

// Compact brand glyphs (lucide dropped brand icons), rendered as dark solid.
const SOCIAL_PATHS: Record<string, string> = {
  facebook: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.68 4.53-4.68 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8v8.44C19.61 23.1 24 18.1 24 12.07z',
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.22.42.56.21.96.47 1.38.89.42.42.68.82.89 1.38.17.42.37 1.05.42 2.22.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.42 2.22-.21.56-.47.96-.89 1.38-.42.42-.82.68-1.38.89-.42.17-1.05.37-2.22.42-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.22-.42a3.81 3.81 0 01-1.38-.89 3.81 3.81 0 01-.89-1.38c-.17-.42-.37-1.05-.42-2.22C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.42-2.22.21-.56.47-.96.89-1.38.42-.42.82-.68 1.38-.89.42-.17 1.05-.37 2.22-.42C8.42 2.17 8.8 2.16 12 2.16M12 5.84A6.16 6.16 0 1018.16 12 6.16 6.16 0 0012 5.84m0 10.16a4 4 0 114-4 4 4 0 01-4 4m6.41-10.4a1.44 1.44 0 11-1.44-1.44 1.44 1.44 0 011.44 1.44z',
  pinterest: 'M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2 .03-2.86.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.48c0-1.39.81-2.43 1.81-2.43.85 0 1.27.64 1.27 1.41 0 .86-.55 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.15-1.88 3.15-4.58 0-2.4-1.72-4.07-4.18-4.07-2.85 0-4.52 2.14-4.52 4.35 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.33-.26 1-.29 1.14-.05.19-.15.23-.35.14-1.3-.6-2.11-2.5-2.11-4.02 0-3.28 2.38-6.29 6.87-6.29 3.61 0 6.41 2.57 6.41 6 0 3.58-2.26 6.47-5.4 6.47-1.05 0-2.04-.55-2.38-1.2l-.65 2.47c-.23.9-.86 2.03-1.29 2.72.97.3 2 .46 3.07.46 5.52 0 10-4.48 10-10S17.52 2 12 2z',
  tiktok: 'M16.6 5.82a4.28 4.28 0 01-1.06-2.82h-3.2v12.86a2.6 2.6 0 11-2.6-2.6c.27 0 .53.04.78.12V10.1a5.79 5.79 0 00-.78-.05 5.78 5.78 0 105.78 5.78V9.01a7.4 7.4 0 004.32 1.38V7.19a4.28 4.28 0 01-3.24-1.37z',
};

function SocialIcon({ kind, url }: { kind: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={kind}
      className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/70 hover:text-primary transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5" aria-hidden="true">
        <path d={SOCIAL_PATHS[kind]} />
      </svg>
    </a>
  );
}

export function Footer() {
  const { data } = useQuery({ queryKey: ['site-settings'], queryFn: fetchSettings });
  const s = data ?? FALLBACK;

  const socials = [
    { kind: 'facebook', url: s.facebookUrl },
    { kind: 'pinterest', url: s.pinterestUrl },
    { kind: 'instagram', url: s.instagramUrl },
    { kind: 'tiktok', url: s.tiktokUrl },
  ].filter((x) => x.url);

  const badges = (s.acceptedPayments ?? []).filter((k) => PAYMENT_BADGES[k]);

  return (
    <footer className="bg-muted/20 border-t border-border/60 mt-auto">
      <div className="container mx-auto px-4 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8">
          {/* About us */}
          <div>
            <h4 className="font-bold text-sm mb-4">{s.aboutHeading}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {s.aboutLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer support */}
          <div>
            <h4 className="font-bold text-sm mb-4">{s.supportHeading}</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              {s.supportLinks.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-primary transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Get in touch */}
          <div>
            <h4 className="font-bold text-sm mb-4">Get in touch</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {s.contactPhone && (
                <li>
                  <a href={`tel:${s.contactPhone.replace(/\s+/g, '')}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                    <Phone className="w-4 h-4 shrink-0" /> <span className="underline underline-offset-2">{s.contactPhone}</span>
                  </a>
                </li>
              )}
              {s.contactEmail && (
                <li>
                  <a href={`mailto:${s.contactEmail}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                    <Mail className="w-4 h-4 shrink-0" /> <span className="underline underline-offset-2">Email us</span>
                  </a>
                </li>
              )}
              {s.liveChatUrl && (
                <li>
                  <a href={s.liveChatUrl} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                    <MessageCircle className="w-4 h-4 shrink-0" /> <span className="underline underline-offset-2">Live chat</span>
                  </a>
                </li>
              )}
            </ul>

            {socials.length > 0 && (
              <>
                <h4 className="font-bold text-sm mt-6 mb-2">Follow us</h4>
                <div className="flex -ml-1.5">
                  {socials.map((x) => <SocialIcon key={x.kind} kind={x.kind} url={x.url} />)}
                </div>
              </>
            )}
          </div>

          {/* We accept + Currency */}
          <div>
            <h4 className="font-bold text-sm mb-4">We accept</h4>
            <div className="flex flex-wrap gap-2">
              {badges.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center h-7 px-2.5 rounded-md bg-background border border-border text-[11px] font-bold tracking-tight"
                  style={{ color: PAYMENT_BADGES[k].color }}
                >
                  {PAYMENT_BADGES[k].label}
                </span>
              ))}
            </div>

            <h4 className="font-bold text-sm mt-6 mb-2">Currency</h4>
            <div className="inline-flex items-center justify-between gap-3 h-10 px-3 rounded-lg bg-background border border-border text-sm min-w-[10rem]">
              <span>{s.currencyLabel}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {s.copyrightText}. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of use</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
