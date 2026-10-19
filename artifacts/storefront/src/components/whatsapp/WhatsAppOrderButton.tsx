import React from 'react';
import { SiWhatsapp } from 'react-icons/si';
import { classNames } from '@/lib/utils';
import { logWhatsAppOrder, whatsappOrderHref, type WaOrder } from '@/lib/whatsappOrder';

// "Order on WhatsApp" — a first-class way to buy for shoppers who'd rather chat.
// Renders nothing until the shop has a WhatsApp number (or phone) set.
export function WhatsAppOrderButton({
  settings,
  order,
  variant = 'full',
  label = 'Order on WhatsApp',
  className,
  disabled,
}: {
  settings: any;
  order: WaOrder | null;
  variant?: 'full' | 'icon';
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  const href = order ? whatsappOrderHref(settings, order) : null;
  if (!href) return null;
  const off = disabled || !order || order.lines.length === 0;
  return (
    <a
      href={off ? undefined : href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      aria-disabled={off}
      data-testid={`whatsapp-order-${variant}`}
      onClick={(e) => {
        if (off) {
          e.preventDefault();
          return;
        }
        if (order) logWhatsAppOrder(order);
      }}
      className={classNames(
        'inline-flex items-center justify-center gap-2 font-bold rounded-md transition-all active:scale-[0.98] select-none',
        variant === 'icon'
          ? 'h-12 w-12 shrink-0 bg-[#25D366] text-white shadow-md shadow-[#25D366]/30 hover:bg-[#1ebe5b]'
          : 'h-12 w-full border-2 border-[#25D366] text-[#128C4B] bg-[#25D366]/5 hover:bg-[#25D366]/10 text-sm',
        off && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      <SiWhatsapp className={variant === 'icon' ? 'w-6 h-6' : 'w-5 h-5 text-[#25D366]'} />
      {variant === 'full' && <span>{label}</span>}
    </a>
  );
}
