import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, productsTable, productVariantsTable, categoriesTable, blogPostsTable } from "@workspace/db";

// The storefront is a client-rendered SPA, but link-preview crawlers (WhatsApp,
// Facebook, X, Telegram, LinkedIn, Slack) and search bots read the raw HTML and
// don't run JavaScript. So for every page we render the right <title>,
// description, Open Graph / Twitter card and (for products) JSON-LD structured
// data into the HTML shell on the server. A shared product link then shows the
// product photo, name and price instead of a generic site card.

const BRAND = "Happyfine Wholesalers";
const DEFAULT_TITLE = `${BRAND} — Wholesale prices, delivered across Kenya`;
const DEFAULT_DESC =
  "Quality electronics, beauty, home and fitness products at wholesale prices. Fast delivery across Kenya. Pay with M-Pesa, Airtel Money or card.";

export interface PageMeta {
  title: string;
  description: string;
  image?: string | null;
  type?: "website" | "product" | "article";
  canonicalPath?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | null;
  price?: { amount: number; currency: string };
}

const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  "/about": { title: `Our story — ${BRAND}`, description: "Who we are and why we sell at wholesale prices, delivered across Kenya." },
  "/faq": { title: `FAQ — ${BRAND}`, description: "Answers to the questions customers ask us most about orders, delivery and payment." },
  "/contact": { title: `Contact us — ${BRAND}`, description: "Talk to our team in Nairobi. We're happy to help with orders, delivery and returns." },
  "/shipping": { title: `Shipping information — ${BRAND}`, description: "How and when your order reaches you, with delivery rates for towns across Kenya." },
  "/returns": { title: `Refunds & returns — ${BRAND}`, description: "Not right? Here is how returns and refunds work." },
  "/terms": { title: `Terms of use — ${BRAND}`, description: "The basics of shopping with Happyfine Wholesalers." },
  "/privacy": { title: `Privacy policy — ${BRAND}`, description: "How we handle and protect your information." },
  "/blog": { title: `The Journal — ${BRAND}`, description: "Buying guides, product spotlights and tips from the Happyfine team." },
  "/products": { title: `Shop all products — ${BRAND}`, description: DEFAULT_DESC },
};

// Pages that should never appear in search results.
const PRIVATE_PREFIXES = ["/admin", "/checkout", "/account", "/orders"];

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function clip(s: string | null | undefined, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// The public origin used for absolute URLs in previews. PUBLIC_URL wins (set it
// on the host for a stable canonical domain); otherwise derive it from the
// request, which is correct behind Railway/cPanel once `trust proxy` is on.
export function publicOrigin(req: Request): string {
  const fixed = (process.env["PUBLIC_URL"] ?? "").trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  return `${req.protocol}://${req.host}`;
}

function absolute(url: string | null | undefined, origin: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Work out the metadata for a request path. Never throws — falls back to the
// brand defaults so a database hiccup can't break page delivery.
export async function metaForPath(path: string, query: Record<string, unknown>, origin: string): Promise<PageMeta> {
  const base: PageMeta = { title: DEFAULT_TITLE, description: DEFAULT_DESC, type: "website", canonicalPath: path };

  if (PRIVATE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return { ...base, title: BRAND, noindex: true, canonicalPath: undefined };
  }

  try {
    const productMatch = path.match(/^\/products\/(\d+)\/?$/);
    if (productMatch) {
      const id = parseInt(productMatch[1], 10);
      const [p] = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          description: productsTable.description,
          imageUrl: productsTable.imageUrl,
          basePrice: productsTable.basePrice,
          discountPercent: productsTable.discountPercent,
          rating: productsTable.rating,
          reviewCount: productsTable.reviewCount,
          status: productsTable.status,
          categoryName: categoriesTable.name,
        })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
        .where(eq(productsTable.id, id));
      if (p && p.status === "active") {
        const [{ stock }] = await db
          .select({ stock: sql<number>`cast(coalesce(sum(${productVariantsTable.stock}), 0) as int)` })
          .from(productVariantsTable)
          .where(eq(productVariantsTable.productId, id));
        const listPrice = parseFloat(p.basePrice);
        const price = Math.round(listPrice * (1 - Math.min(Math.max(p.discountPercent ?? 0, 0), 90) / 100));
        const priceLine = `KES ${price.toLocaleString("en-KE")}`;
        const rating = p.rating != null ? Number(p.rating) : 0;
        const ratingLine = p.reviewCount > 0 ? ` ★ ${rating.toFixed(1)} (${p.reviewCount} reviews)` : "";
        const desc = clip(p.description, 150) || `Shop ${p.name} at wholesale prices.`;
        const image = absolute(p.imageUrl, origin);
        return {
          title: `${p.name} — ${BRAND}`,
          description: `${priceLine}${ratingLine} · ${desc} Delivered across Kenya.`,
          image,
          type: "product",
          canonicalPath: `/products/${p.id}`,
          price: { amount: price, currency: "KES" },
          jsonLd: {
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            description: clip(p.description, 300) || undefined,
            image: image ? [image] : undefined,
            category: p.categoryName ?? undefined,
            url: `${origin}/products/${p.id}`,
            offers: {
              "@type": "Offer",
              priceCurrency: "KES",
              price: String(price),
              availability: stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url: `${origin}/products/${p.id}`,
            },
            ...(p.reviewCount > 0 && rating > 0
              ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: p.reviewCount } }
              : {}),
          },
        };
      }
    }

    const blogMatch = path.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch) {
      const [post] = await db
        .select()
        .from(blogPostsTable)
        .where(and(eq(blogPostsTable.slug, decodeURIComponent(blogMatch[1])), eq(blogPostsTable.status, "published")));
      if (post) {
        return {
          title: /happyfine/i.test(post.metaTitle || post.title) ? post.metaTitle || post.title : `${post.metaTitle || post.title} — ${BRAND}`,
          description: clip(post.metaDescription || post.excerpt || post.content, 180) || DEFAULT_DESC,
          image: absolute(post.coverImageUrl, origin),
          type: "article",
          canonicalPath: `/blog/${post.slug}`,
        };
      }
    }

    if (path === "/products" && typeof query["category"] === "string") {
      const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, query["category"]));
      if (cat) {
        return {
          title: `${cat.name} — ${BRAND}`,
          description: clip(cat.description, 180) || `Shop ${cat.name} at wholesale prices. Delivered across Kenya.`,
          image: absolute(cat.imageUrl, origin),
          type: "website",
          canonicalPath: `/products?category=${cat.slug}`,
        };
      }
    }

    const page = STATIC_PAGES[path.replace(/\/+$/, "") || "/"];
    if (page) return { ...base, ...page };

    if (path === "/") {
      // Use the newest featured product's photo so the home link has an image.
      const [hero] = await db
        .select({ imageUrl: productsTable.imageUrl })
        .from(productsTable)
        .where(and(eq(productsTable.status, "active"), eq(productsTable.featured, true)))
        .limit(1);
      return { ...base, image: absolute(hero?.imageUrl, origin) };
    }
  } catch {
    // fall through to defaults
  }
  return base;
}

// Strip the template's placeholder head tags and inject the real ones.
export function renderHead(html: string, meta: PageMeta, origin: string): string {
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>\s*/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi, "");

  const url = meta.canonicalPath ? `${origin}${meta.canonicalPath}` : null;
  const tags: string[] = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}" />`,
    `<meta property="og:site_name" content="${esc(BRAND)}" />`,
    `<meta property="og:locale" content="en_KE" />`,
    `<meta property="og:type" content="${meta.type === "product" ? "product" : meta.type ?? "website"}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
  ];
  if (url) {
    tags.push(`<link rel="canonical" href="${esc(url)}" />`, `<meta property="og:url" content="${esc(url)}" />`);
  }
  if (meta.image) {
    tags.push(
      `<meta property="og:image" content="${esc(meta.image)}" />`,
      `<meta property="og:image:alt" content="${esc(meta.title)}" />`,
      `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    );
  }
  if (meta.price) {
    tags.push(
      `<meta property="product:price:amount" content="${meta.price.amount}" />`,
      `<meta property="product:price:currency" content="${meta.price.currency}" />`,
    );
  }
  if (meta.jsonLd) {
    // `<` is escaped so product text can never close the script tag.
    const json = JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c");
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return stripped.replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

// ── Sitemap + robots ─────────────────────────────────────────────────────────
export async function buildSitemap(origin: string): Promise<string> {
  const urls: { loc: string; lastmod?: string; priority?: string }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/products`, priority: "0.9" },
    { loc: `${origin}/blog`, priority: "0.6" },
    ...Object.keys(STATIC_PAGES)
      .filter((p) => p !== "/products" && p !== "/blog")
      .map((p) => ({ loc: `${origin}${p}`, priority: "0.3" })),
  ];
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : undefined);
  const products = await db
    .select({ id: productsTable.id, updatedAt: productsTable.updatedAt })
    .from(productsTable)
    .where(eq(productsTable.status, "active"));
  for (const p of products) urls.push({ loc: `${origin}/products/${p.id}`, lastmod: iso(p.updatedAt), priority: "0.8" });
  const cats = await db.select({ slug: categoriesTable.slug }).from(categoriesTable);
  for (const c of cats) urls.push({ loc: `${origin}/products?category=${c.slug}`, priority: "0.7" });
  const posts = await db
    .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"));
  for (const b of posts) urls.push({ loc: `${origin}/blog/${b.slug}`, lastmod: iso(b.updatedAt), priority: "0.5" });

  const body = urls
    .map(
      (u) =>
        `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function buildRobots(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /orders",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
