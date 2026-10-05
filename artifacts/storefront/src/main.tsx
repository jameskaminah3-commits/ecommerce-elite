import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

setBaseUrl(import.meta.env.VITE_API_BASE_URL ?? null);

// Capture a referral code from a shared link (?ref=CODE) into a cookie the API
// reads at registration/checkout. Kept for 30 days; the URL param is cleaned up.
try {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && /^[A-Za-z0-9-]{3,40}$/.test(ref)) {
    document.cookie = `ref=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    localStorage.setItem('referralCode', ref);
    params.delete('ref');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }
} catch {
  // Non-fatal — referral capture is best-effort.
}

createRoot(document.getElementById('root')!).render(<App />);
