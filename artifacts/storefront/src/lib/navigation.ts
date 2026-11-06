// Was the latest navigation the browser's Back/Forward button?
// wouter announces link navigations with a "pushState" event; the browser fires
// "popstate" for Back/Forward. Pages use this to restore the shopper's place on
// Back, and start new pages at the top.
let backForward = false;

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    backForward = true;
  });
  window.addEventListener('pushState', () => {
    backForward = false;
  });
}

export function isBackForwardNavigation(): boolean {
  return backForward;
}
