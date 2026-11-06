import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useSearch } from 'wouter';
import { isBackForwardNavigation } from '@/lib/navigation';

// Every new page — and every new category — opens at the top, like a full page
// load would. Back/Forward keeps the shopper's place (the product list restores
// it), sorting/filtering within a category doesn't jump, and #anchors still work.
export function ScrollManager() {
  const [path] = useLocation();
  const params = new URLSearchParams(useSearch());
  const key = `${path}|${params.get('category') ?? ''}|${params.get('search') ?? ''}`;
  const first = useRef(true);

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isBackForwardNavigation()) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Let the page render, then bring the anchor (e.g. #reviews) into view.
      window.setTimeout(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: 'start' }), 350);
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [key]);

  return null;
}
