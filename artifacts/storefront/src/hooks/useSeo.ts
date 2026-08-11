import { useEffect } from 'react';

export interface SeoInput {
  title: string;
  description?: string;
  /** Absolute path used for canonical + og:url, e.g. "/blog/my-post". Defaults to current path. */
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

// Client-side SEO: title, description, canonical, Open Graph / Twitter cards and
// JSON-LD structured data. Googlebot renders JS, so these are picked up for
// indexing. (For maximal SEO, add SSR/prerender later — this is the ready base.)
export function useSeo(seo: SeoInput) {
  const jsonLdKey = seo.jsonLd ? JSON.stringify(seo.jsonLd) : '';
  useEffect(() => {
    const prevTitle = document.title;
    document.title = seo.title;

    if (seo.description) upsertMeta('name', 'description', seo.description);
    upsertMeta('property', 'og:title', seo.title);
    if (seo.description) upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:type', seo.type ?? 'website');
    upsertMeta('property', 'og:site_name', 'Happyfine Wholesalers');

    const url = window.location.origin + (seo.canonicalPath ?? window.location.pathname);
    upsertMeta('property', 'og:url', url);
    upsertMeta('name', 'twitter:card', seo.image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', seo.title);
    if (seo.description) upsertMeta('name', 'twitter:description', seo.description);
    if (seo.image) {
      upsertMeta('property', 'og:image', seo.image);
      upsertMeta('name', 'twitter:image', seo.image);
    }

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;

    let script = document.getElementById('page-jsonld') as HTMLScriptElement | null;
    if (seo.jsonLd) {
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'page-jsonld';
        document.head.appendChild(script);
      }
      script.textContent = jsonLdKey;
    } else if (script) {
      script.remove();
    }

    return () => {
      document.title = prevTitle;
    };
  }, [seo.title, seo.description, seo.canonicalPath, seo.image, seo.type, jsonLdKey]);
}
