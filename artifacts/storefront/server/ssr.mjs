// Production SEO server for the storefront.
//
// Serves the built SPA and, for crawlable routes, injects fully-rendered
// <head> SEO (title, description, canonical, Open Graph / Twitter, JSON-LD) and
// the page's key content into the initial HTML — fetched from the API. Crawlers
// (and non-JS clients / social scrapers) see correct metadata and real content
// without running JavaScript; the React app then client-renders over it.
//
// Env:
//   PORT              port to listen on (default 5175)
//   INTERNAL_API_URL  API base for data fetches (default VITE_API_BASE_URL or http://localhost:3000)
//   SITE_URL          public origin for canonical/OG URLs (default https://happyfine.co.ke)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist/public');
const TEMPLATE = fs.readFileSync(path.join(DIST, 'index.html'), 'utf-8');

const PORT = parseInt(process.env.PORT || '5175', 10);
const API = (process.env.INTERNAL_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SITE = (process.env.SITE_URL || 'https://happyfine.co.ke').replace(/\/+$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json',
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Minimal, safe Markdown → HTML (mirrors the client renderer; escapes first).
function renderMarkdown(md) {
  const inline = (t) =>
    t
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" loading="lazy" />')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const lines = esc(md || '').split(/\r?\n/);
  const out = [];
  let para = [];
  let inList = false;
  const flushP = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushL = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushP(); flushL(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushP(); flushL(); out.push(`<h${Math.min(h[1].length + 1, 5)}>${inline(h[2])}</h${Math.min(h[1].length + 1, 5)}>`); continue; }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { flushP(); if (!inList) { out.push('<ul>'); inList = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    para.push(line);
  }
  flushP(); flushL();
  return out.join('\n');
}

function buildHead({ title, description, canonical, image, type = 'website', jsonLd, noindex }) {
  const tags = [
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}">` : '',
    `<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}">`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    description ? `<meta property="og:description" content="${esc(description)}">` : '',
    `<meta property="og:type" content="${esc(type)}">`,
    `<meta property="og:url" content="${esc(canonical)}">`,
    `<meta property="og:site_name" content="Happyfine Wholesalers">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    description ? `<meta name="twitter:description" content="${esc(description)}">` : '',
    image ? `<meta name="twitter:image" content="${esc(image)}">` : '',
    ...(jsonLd ? [].concat(jsonLd).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`) : []),
  ].filter(Boolean).join('\n    ');
  return tags;
}

function renderPage({ head, content }) {
  // Strip the SPA's static SEO tags so per-route ones don't duplicate them.
  let html = TEMPLATE
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:(?:title|description|type|url|site_name|image)"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:(?:card|title|description|image)"[^>]*>/gi, '');
  html = html.replace('</head>', `    ${head}\n  </head>`);
  if (content) {
    // Crawlable content inside #root; React client-render replaces it on mount.
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root"><div id="ssr-seo">${content}</div></div>`);
  }
  return html;
}

async function apiJson(pathname) {
  try {
    const r = await fetch(`${API}${pathname}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const DEFAULT_TITLE = 'Happyfine Wholesalers — Wholesale prices, delivered across Kenya';
const DEFAULT_DESC = 'Thousands of products at wholesale prices, direct from our Nairobi warehouse. Home, electronics, beauty and fitness — quality stock in bulk.';

async function seoFor(url) {
  const canonical = SITE + url;

  // Blog post
  let m = url.match(/^\/blog\/([^/?#]+)$/);
  if (m) {
    const post = await apiJson(`/api/blog-posts/${m[1]}`);
    if (!post) {
      return { status: 404, head: buildHead({ title: 'Post not found — Happyfine', canonical, noindex: true }), content: '' };
    }
    const date = post.publishedAt || post.createdAt;
    const head = buildHead({
      title: `${post.metaTitle || post.title} — Happyfine Journal`,
      description: post.metaDescription || post.excerpt || post.title,
      canonical, image: post.coverImageUrl || undefined, type: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title,
          description: post.metaDescription || post.excerpt || '', image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
          datePublished: date, dateModified: post.updatedAt,
          author: { '@type': 'Organization', name: post.author },
          publisher: { '@type': 'Organization', name: 'Happyfine Wholesalers' },
          mainEntityOfPage: canonical, keywords: (post.tags || []).join(', '),
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: 'Journal', item: `${SITE}/blog` },
            { '@type': 'ListItem', position: 3, name: post.title, item: canonical },
          ],
        },
      ],
    });
    const content = `<article><h1>${esc(post.title)}</h1>` +
      `<p>${esc(post.excerpt || '')}</p>` +
      (post.coverImageUrl ? `<img src="${esc(post.coverImageUrl)}" alt="${esc(post.title)}" />` : '') +
      renderMarkdown(post.content) +
      `<p>By ${esc(post.author)}</p></article>`;
    return { status: 200, head, content };
  }

  // Product detail
  m = url.match(/^\/products\/(\d+)$/);
  if (m) {
    const p = await apiJson(`/api/products/${m[1]}`);
    if (!p) {
      return { status: 404, head: buildHead({ title: 'Product not found — Happyfine', canonical, noindex: true }), content: '' };
    }
    const price = typeof p.basePrice === 'number' ? p.basePrice : parseFloat(p.basePrice || '0');
    const inStock = (p.totalStock ?? 0) > 0;
    const desc = (p.description || `${p.name} at wholesale prices from Happyfine Wholesalers.`).slice(0, 300);
    const head = buildHead({
      title: `${p.name} — Happyfine Wholesalers`,
      description: desc, canonical, image: p.imageUrl || undefined, type: 'website',
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'Product', name: p.name,
        image: p.imageUrl ? [p.imageUrl] : undefined, description: desc,
        category: p.categoryName || undefined,
        aggregateRating: p.rating ? { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviewCount || 0 } : undefined,
        offers: {
          '@type': 'Offer', price: price.toFixed(2), priceCurrency: 'KES',
          availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          url: canonical,
        },
      },
    });
    const content = `<div><h1>${esc(p.name)}</h1><p>${esc(desc)}</p><p>KES ${esc(price.toFixed(0))}</p></div>`;
    return { status: 200, head, content };
  }

  // Blog list
  if (url === '/blog') {
    const data = await apiJson('/api/blog-posts?limit=12');
    const items = (data?.items || []);
    const head = buildHead({
      title: 'The Happyfine Journal — Wholesale tips & new stock',
      description: 'Guides, product spotlights and wholesale buying tips from Happyfine Wholesalers, Kenya.',
      canonical, type: 'website',
      jsonLd: { '@context': 'https://schema.org', '@type': 'Blog', name: 'The Happyfine Journal', url: canonical },
    });
    const content = `<div><h1>From the journal</h1><ul>` +
      items.map((p) => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a> — ${esc(p.excerpt || '')}</li>`).join('') +
      `</ul></div>`;
    return { status: 200, head, content };
  }

  // Products listing
  if (url === '/products') {
    return {
      status: 200,
      head: buildHead({
        title: 'All Products — Happyfine Wholesalers',
        description: 'Browse the full wholesale catalogue: electronics, home & living, beauty and fitness.',
        canonical, type: 'website',
      }),
      content: '',
    };
  }

  // Home
  if (url === '/') {
    return {
      status: 200,
      head: buildHead({
        title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical, type: 'website',
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'Organization', name: 'Happyfine Wholesalers', url: SITE },
          { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Happyfine Wholesalers', url: SITE,
            potentialAction: { '@type': 'SearchAction', target: `${SITE}/products?search={q}`, 'query-input': 'required name=q' } },
        ],
      }),
      content: '',
    };
  }

  // Everything else: default document meta, SPA handles the view.
  return {
    status: 200,
    head: buildHead({ title: DEFAULT_TITLE, description: DEFAULT_DESC, canonical: SITE + url, type: 'website' }),
    content: '',
  };
}

function tryServeStatic(reqPath, res) {
  // Only treat as a static asset if it has a file extension or is a known root file.
  const clean = decodeURIComponent(reqPath.split('?')[0]);
  if (clean === '/' || !path.extname(clean)) return false;
  const filePath = path.normalize(path.join(DIST, clean));
  if (!filePath.startsWith(DIST)) return false; // path traversal guard
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const immutable = clean.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];
    if (tryServeStatic(req.url || '/', res)) return;
    const { status, head, content } = await seoFor(url);
    const html = renderPage({ head, content });
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    console.error('SSR error', err);
    res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(TEMPLATE);
  }
});

server.listen(PORT, () => {
  console.log(`Storefront SEO server on http://localhost:${PORT}  (API: ${API}, SITE: ${SITE})`);
});
