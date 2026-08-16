import React from 'react';

// Self-contained payment-network badges rendered as small card "pictures"
// (no external images, CSP-safe). Simplified, recognisable marks for the
// footer's "We accept" row.
const SUPPORTED = ['mpesa', 'visa', 'mastercard', 'amex', 'paypal', 'discover', 'diners', 'airtel'] as const;
export type PaymentKind = (typeof SUPPORTED)[number];

export function isPaymentKind(k: string): k is PaymentKind {
  return (SUPPORTED as readonly string[]).includes(k);
}

export function PaymentLogo({ kind }: { kind: string }) {
  const common = { width: 42, height: 28, viewBox: '0 0 42 28', role: 'img', 'aria-label': kind } as const;
  const whiteCard = <rect x="0.5" y="0.5" width="41" height="27" rx="4" fill="#ffffff" stroke="#E5E5E5" />;

  switch (kind) {
    case 'visa':
      return (
        <svg {...common}>
          {whiteCard}
          <text x="21" y="18.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" fontSize="12" letterSpacing="0.5" fill="#1A1F71">VISA</text>
        </svg>
      );
    case 'mastercard':
      return (
        <svg {...common}>
          {whiteCard}
          <circle cx="17" cy="14" r="7.5" fill="#EB001B" />
          <circle cx="25" cy="14" r="7.5" fill="#F79E1B" fillOpacity="0.9" />
        </svg>
      );
    case 'amex':
      return (
        <svg {...common}>
          <rect x="0.5" y="0.5" width="41" height="27" rx="4" fill="#2E77BC" stroke="#2E77BC" />
          <text x="21" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="8" letterSpacing="0.5" fill="#ffffff">AMEX</text>
        </svg>
      );
    case 'paypal':
      return (
        <svg {...common}>
          {whiteCard}
          <text x="21" y="18" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontStyle="italic" fontSize="10">
            <tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan>
          </text>
        </svg>
      );
    case 'discover':
      return (
        <svg {...common}>
          {whiteCard}
          <text x="18" y="17.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="6.2" letterSpacing="0.3" fill="#1A1A1A">DISCOVER</text>
          <circle cx="34" cy="15.5" r="4" fill="#FF6000" />
        </svg>
      );
    case 'diners':
      return (
        <svg {...common}>
          {whiteCard}
          <circle cx="16" cy="14" r="7" fill="#0079BE" />
          <circle cx="16" cy="14" r="3.2" fill="#ffffff" />
          <text x="27" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="5.4" fill="#0079BE">DINERS</text>
        </svg>
      );
    case 'airtel':
      return (
        <svg {...common}>
          <rect x="0.5" y="0.5" width="41" height="27" rx="4" fill="#E40000" stroke="#C40000" />
          <text x="21" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="6.6" fill="#ffffff">AIRTEL</text>
        </svg>
      );
    case 'mpesa':
    default:
      return (
        <svg {...common}>
          <rect x="0.5" y="0.5" width="41" height="27" rx="4" fill="#37A000" stroke="#2E8500" />
          <text x="21" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="8" letterSpacing="0.3" fill="#ffffff">M-PESA</text>
        </svg>
      );
  }
}
