import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { SiWhatsapp } from 'react-icons/si';

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// A floating "chat to order" button. WhatsApp is where many Kenyan shoppers ask
// "is it available?" before paying, so one tap from any page matters. It uses the
// admin's existing "Live chat URL" setting (e.g. https://wa.me/2547XXXXXXXX) and
// stays hidden until that is set.
export function ChatBubble() {
  const { data } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/site-settings`);
      return r.ok ? r.json() : {};
    },
  });
  const url = (data?.liveChatUrl as string | undefined)?.trim();
  if (!url) return null;
  const isWhatsapp = /wa\.me|whatsapp/i.test(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={isWhatsapp ? 'Chat with us on WhatsApp' : 'Chat with us'}
      // Sits above the mobile sticky add-to-cart bar; drops to the corner on desktop.
      className={`fixed right-3 bottom-[88px] md:right-6 md:bottom-6 z-30 h-12 w-12 md:w-auto md:px-5 opacity-95 rounded-full shadow-lg shadow-black/20 flex items-center justify-center gap-2 text-white font-semibold text-sm transition-transform hover:scale-105 active:scale-95 ${
        isWhatsapp ? 'bg-[#25D366]' : 'bg-primary'
      }`}
    >
      {isWhatsapp ? <SiWhatsapp className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      <span className="hidden md:inline">Chat to order</span>
    </a>
  );
}
