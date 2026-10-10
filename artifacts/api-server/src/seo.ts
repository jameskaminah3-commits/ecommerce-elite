import type { Request } from "express";
import { logger } from "./lib/logger";
import { productPath } from "./lib/slug";
import { loadPricingPromos, effectiveDiscount } from "./lib/pricing";
import { and, eq, sql } from "drizzle-orm";
import { db, productsTable, productVariantsTable, categoriesTable, blogPostsTable, siteSettingsTable } from "@workspace/db";

// The storefront is a client-rendered SPA, but link-preview crawlers (WhatsApp,
// Facebook, X, Telegram, LinkedIn, Slack) and search bots read the raw HTML and
// don't run JavaScript. So for every page we render the right <title>,
// description, Open Graph / Twitter card and (for products) JSON-LD structured
// data into the HTML shell on the server. A shared product link then shows the
// product photo, name and price instead of a generic site card.

const BRAND = "Happyfine Wholesalers";
// "Wholesale" describes the PRICE, not who may buy or how much: anyone can buy a
// single item at the wholesale price. Every page's copy leans on that promise.
const DEFAULT_TITLE = `${BRAND} — Wholesale Prices for Everyone in Kenya`;
const DEFAULT_DESC =
  "Shop electronics, beauty, home and fitness at wholesale prices — no minimum order, buy just one. Pay with M-Pesa, Airtel Money or card. Delivery across Kenya.";

type JsonLd = Record<string, unknown>;

export interface PageMeta {
  title: string;
  /** Shorter, punchier title for social cards (falls back to `title`). */
  ogTitle?: string;
  description: string;
  image?: string | null;
  /** Describes the share image (falls back to the social title). */
  imageAlt?: string;
  type?: "website" | "product" | "article";
  canonicalPath?: string;
  /** true = hide the page and its links; "follow" = hide the page but let crawlers follow its links. */
  noindex?: boolean | "follow";
  /** HTTP status to serve the shell with (e.g. 404 for an unknown product). */
  status?: number;
  jsonLd?: JsonLd | JsonLd[] | null;
  price?: { amount: number; currency: string };
  availability?: "instock" | "oos";
}

const kes = (n: number) => `KES ${Math.round(n).toLocaleString("en-KE")}`;

// Google shows roughly the first 60–65 characters of a title. Keep the product name
// and price (what people search and click on) and drop the extras when space is short.
export function productSeoTitle(name: string, priceText: string): string {
  const candidates = [
    `${name} Price in Kenya — ${priceText} | ${BRAND}`,
    `${name} Price in Kenya — ${priceText}`,
    `${name} — ${priceText} | ${BRAND}`,
    `${name} — ${priceText}`,
  ];
  const fit = candidates.find((c) => c.length <= 65);
  if (fit) return fit;
  const suffix = ` — ${priceText}`;
  return `${clip(name, Math.max(20, 65 - suffix.length))}${suffix}`;
}

const STATIC_PAGES: Record<string, { title: string; description: string }> = {
  "/about": { title: `Our story — ${BRAND}`, description: "Why we sell at wholesale prices to everyone — no minimum order, no middlemen, delivered across Kenya." },
  "/faq": { title: `FAQ — ${BRAND}`, description: "Is there a minimum order? How do I pay? How fast is delivery? Answers to what customers ask us most." },
  "/contact": { title: `Contact us — ${BRAND}`, description: "Talk to our team in Nairobi. We're happy to help with orders, delivery and returns." },
  "/shipping": { title: `Shipping information — ${BRAND}`, description: "How and when your order reaches you, with delivery rates for towns across Kenya." },
  "/returns": { title: `Refunds & returns — ${BRAND}`, description: "Not right? Here is how returns and refunds work." },
  "/terms": { title: `Terms of use — ${BRAND}`, description: "The basics of shopping with Happyfine Wholesalers." },
  "/privacy": { title: `Privacy policy — ${BRAND}`, description: "How we handle and protect your information." },
  "/blog": { title: `The Journal — ${BRAND}`, description: "Buying guides, product spotlights and money-saving tips from the Happyfine team." },
  "/products": { title: `Shop All Products at Wholesale Prices — ${BRAND}`, description: DEFAULT_DESC },
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
  if (t.length <= max) return t;
  // Cut at a word boundary so snippets never end mid-word ("po…").
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-—]+$/, "")}…`;
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
    // Product URLs are /products/<id>-<keyword-slug>; the bare /products/<id> form
    // still works (older links) and points search engines at the slug version.
    const productMatch = path.match(/^\/products\/(\d+)(?:-[^/]*)?\/?$/);
    if (productMatch) {
      const id = parseInt(productMatch[1], 10);
      const [p] = await db
        .select({
          id: productsTable.id,
          name: productsTable.name,
          slug: productsTable.slug,
          description: productsTable.description,
          imageUrl: productsTable.imageUrl,
          images: productsTable.images,
          basePrice: productsTable.basePrice,
          compareAtPrice: productsTable.compareAtPrice,
          categoryId: productsTable.categoryId,
          discountPercent: productsTable.discountPercent,
          rating: productsTable.rating,
          reviewCount: productsTable.reviewCount,
          status: productsTable.status,
          metaTitle: productsTable.metaTitle,
          metaDescription: productsTable.metaDescription,
          categoryName: categoriesTable.name,
          categorySlug: categoriesTable.slug,
        })
        .from(productsTable)
        .leftJoin(categoriesTable, eq(categoriesTable.id, productsTable.categoryId))
        .where(eq(productsTable.id, id));
      if (!p || p.status !== "active" || parseFloat(p.basePrice) <= 0) {
        // A real 404 (not a 200 "soft 404") so Google drops dead product URLs.
        return { ...base, title: `Product not found — ${BRAND}`, noindex: "follow", status: 404, canonicalPath: undefined };
      }
      // Only options a shopper can actually buy (priced) count towards price and stock.
      const variants = (
        await db
          .select({ sku: productVariantsTable.sku, price: productVariantsTable.price, stock: productVariantsTable.stock })
          .from(productVariantsTable)
          .where(eq(productVariantsTable.productId, id))
      )
        .map((v) => ({ sku: v.sku, price: parseFloat(v.price), stock: v.stock }))
        .filter((v) => v.price > 0);
      const stock = variants.reduce((n, v) => n + Math.max(0, v.stock), 0);

      // Same rule the storefront uses: an active promo is measured against the
      // list price; otherwise against the admin-set typical retail price.
      const list = parseFloat(p.basePrice);
      const eff = effectiveDiscount(
        { id: p.id, categoryId: p.categoryId, discountPercent: p.discountPercent },
        await loadPricingPromos(),
      );
      const promo = eff.percent;
      const sell = (n: number) => Math.round(n * (1 - promo / 100));
      const price = sell(list);
      const highPrice = variants.length ? sell(Math.max(...variants.map((v) => v.price))) : price;
      const ranged = highPrice > price;
      const compareAt = p.compareAtPrice != null ? parseFloat(p.compareAtPrice) : null;
      const retail = promo > 0 ? list : compareAt != null && compareAt > list ? compareAt : null;
      const savePct = retail ? Math.round(((retail - price) / retail) * 100) : 0;
      const priceText = `${ranged ? "from " : ""}${kes(price)}`;

      const rating = p.rating != null ? Number(p.rating) : 0;
      const ratingLine = p.reviewCount > 0 ? ` ★ ${rating.toFixed(1)} (${p.reviewCount} review${p.reviewCount === 1 ? "" : "s"}).` : "";
      const priceLine =
        retail && savePct > 0
          // A sale compares against our own regular price; otherwise the admin's
          // "typical retail price". Say which, so the claim is accurate.
          ? `Wholesale price ${priceText} (${promo > 0 ? "was" : "retail"} ${kes(retail)} — save ${savePct}%).`
          : `Wholesale price ${priceText}.`;
      const gallery = [p.imageUrl, ...(p.images ?? [])]
        .map((u) => absolute(u, origin))
        .filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i)
        .slice(0, 8);
      const image = gallery[0] ?? null;
      const canonicalPath = productPath(p);
      const url = `${origin}${canonicalPath}`;
      const availability = stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
      const seller = { "@type": "Organization", name: BRAND };

      const offers: JsonLd = ranged
        ? {
            // Options at different prices (e.g. sizes): Google shows the price range.
            "@type": "AggregateOffer",
            priceCurrency: "KES",
            lowPrice: String(price),
            highPrice: String(highPrice),
            offerCount: variants.length,
            availability,
            url,
            seller,
          }
        : {
            "@type": "Offer",
            priceCurrency: "KES",
            price: String(price),
            itemCondition: "https://schema.org/NewCondition",
            // A promotion's price is only valid until the campaign ends.
            ...(eff.promo ? { priceValidUntil: eff.promo.endsAt.toISOString().slice(0, 10) } : {}),
            availability,
            url,
            seller,
            // Lets Google show the struck-through retail price next to ours.
            ...(retail && savePct > 0
              ? {
                  priceSpecification: {
                    "@type": "UnitPriceSpecification",
                    priceType: "https://schema.org/ListPrice",
                    price: String(Math.round(retail)),
                    priceCurrency: "KES",
                  },
                }
              : {}),
          };

      const product: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.name,
        description: clip(p.description, 500) || undefined,
        image: gallery.length ? gallery : undefined,
        ...(variants.length === 1 ? { sku: variants[0].sku } : {}),
        category: p.categoryName ?? undefined,
        url,
        offers,
        ...(p.reviewCount > 0 && rating > 0
          ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: p.reviewCount } }
          : {}),
      };
      const crumbs: JsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
          ...(p.categoryName && p.categorySlug
            ? [{ "@type": "ListItem", position: 2, name: p.categoryName, item: `${origin}/products?category=${p.categorySlug}` }]
            : []),
          { "@type": "ListItem", position: p.categoryName && p.categorySlug ? 3 : 2, name: p.name, item: url },
        ],
      };

      // Each product page gets its own description: price first (that's what makes
      // people click), then a line of the product's own copy, then the promise.
      const tail = " No minimum order — pay with M-Pesa, delivered across Kenya.";
      const room = Math.max(0, 165 - priceLine.length - ratingLine.length - tail.length - 1);
      const snippet = room >= 40 ? clip(p.description, room) : "";
      const autoDescription = `${priceLine}${ratingLine}${snippet ? ` ${snippet}` : ""}${tail}`.replace(/\s+/g, " ").trim();

      return {
        // "<product> price in Kenya" is exactly how Kenyans search for things.
        title: p.metaTitle?.trim() || productSeoTitle(p.name, priceText),
        ogTitle: `${p.name} — ${priceText}${savePct > 0 ? ` · Save ${savePct}%` : ""}`,
        description: p.metaDescription?.trim() || autoDescription,
        image,
        imageAlt: p.name,
        type: "product",
        canonicalPath,
        price: { amount: price, currency: "KES" },
        availability: stock > 0 ? "instock" : "oos",
        jsonLd: [product, crumbs],
      };
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
      return { ...base, title: `Article not found — ${BRAND}`, noindex: "follow", status: 404, canonicalPath: undefined };
    }

    if (path === "/products") {
      // Search results and sorted/filtered/paged variants are thin duplicates of
      // the main listing: keep them out of the index (but let bots follow links).
      const filtered = ["search", "sort", "tags", "minPrice", "maxPrice", "page"].some((k) => query[k] != null && query[k] !== "");
      if (typeof query["category"] === "string") {
        const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, query["category"]));
        if (cat) {
          return {
            title: `${cat.name} at Wholesale Prices in Kenya | ${BRAND}`,
            description: `Shop ${cat.name} at wholesale prices — no minimum order, buy just one. ${clip(cat.description, 90)} Pay with M-Pesa, delivered across Kenya.`.replace(/\s+/g, " "),
            image: absolute(cat.imageUrl, origin),
            type: "website",
            canonicalPath: `/products?category=${cat.slug}`,
            noindex: filtered ? "follow" : undefined,
          };
        }
      }
      return { ...base, ...STATIC_PAGES["/products"], noindex: filtered ? "follow" : undefined, canonicalPath: "/products" };
    }

    const page = STATIC_PAGES[path.replace(/\/+$/, "") || "/"];
    if (page) return { ...base, ...page };

    if (path === "/") {
      // Use a featured product's photo so the home link has an image.
      const [hero] = await db
        .select({ imageUrl: productsTable.imageUrl })
        .from(productsTable)
        .where(and(eq(productsTable.status, "active"), eq(productsTable.featured, true)))
        .limit(1);
      const [settings] = await db.select().from(siteSettingsTable).where(eq(siteSettingsTable.id, 1));
      const sameAs = [settings?.facebookUrl, settings?.instagramUrl, settings?.tiktokUrl, settings?.pinterestUrl].filter(
        (u): u is string => !!u && /^https?:\/\//i.test(u),
      );
      const org: JsonLd = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: BRAND,
        url: `${origin}/`,
        description: DEFAULT_DESC,
        ...(sameAs.length ? { sameAs } : {}),
        ...(settings?.contactPhone || settings?.contactEmail
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                areaServed: "KE",
                ...(settings.contactPhone ? { telephone: settings.contactPhone } : {}),
                ...(settings.contactEmail ? { email: settings.contactEmail } : {}),
              },
            }
          : {}),
      };
      // Enables the Google "search this site" box for the brand.
      const website: JsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: BRAND,
        url: `${origin}/`,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${origin}/products?search={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      };
      return { ...base, image: absolute(hero?.imageUrl, origin), jsonLd: [org, website] };
    }
  } catch (err) {
    // Fall back to the brand defaults so a database hiccup never breaks page
    // delivery — but say so, otherwise previews silently go generic.
    logger.warn({ err, path }, "SEO meta lookup failed — serving default tags");
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
  const social = meta.ogTitle ?? meta.title;
  const robots =
    meta.noindex === "follow" ? "noindex, follow" : meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large";
  const tags: string[] = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
    `<meta property="og:site_name" content="${esc(BRAND)}" />`,
    `<meta property="og:locale" content="en_KE" />`,
    `<meta property="og:type" content="${meta.type === "product" ? "product" : meta.type ?? "website"}" />`,
    `<meta property="og:title" content="${esc(social)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:card" content="${meta.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${esc(social)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
  ];
  if (url) {
    tags.push(`<link rel="canonical" href="${esc(url)}" />`, `<meta property="og:url" content="${esc(url)}" />`);
  }
  if (meta.image) {
    tags.push(
      `<meta property="og:image" content="${esc(meta.image)}" />`,
      `<meta property="og:image:alt" content="${esc(meta.imageAlt ?? social)}" />`,
      `<meta name="twitter:image" content="${esc(meta.image)}" />`,
    );
  }
  if (meta.price) {
    tags.push(
      `<meta property="product:price:amount" content="${meta.price.amount}" />`,
      `<meta property="product:price:currency" content="${meta.price.currency}" />`,
    );
  }
  if (meta.availability) {
    tags.push(`<meta property="product:availability" content="${meta.availability === "instock" ? "in stock" : "out of stock"}" />`);
  }
  if (meta.jsonLd) {
    // `<` is escaped so page text can never close the script tag.
    for (const block of Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`);
    }
  }
  return stripped
    .replace('<html lang="en">', '<html lang="en-KE">')
    .replace("</head>", `    ${tags.join("\n    ")}\n  </head>`);
}

// ── Sitemap + robots ─────────────────────────────────────────────────────────
export async function buildSitemap(origin: string): Promise<string> {
  const urls: { loc: string; lastmod?: string; priority?: string; images?: string[] }[] = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/products`, priority: "0.9" },
    { loc: `${origin}/blog`, priority: "0.6" },
    ...Object.keys(STATIC_PAGES)
      .filter((p) => p !== "/products" && p !== "/blog")
      .map((p) => ({ loc: `${origin}${p}`, priority: "0.3" })),
  ];
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : undefined);
  const products = await db
    .select({
      id: productsTable.id,
      slug: productsTable.slug,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
      images: productsTable.images,
      updatedAt: productsTable.updatedAt,
    })
    .from(productsTable)
    .where(and(eq(productsTable.status, "active"), sql`${productsTable.basePrice} > 0`));
  for (const p of products) {
    // Product photos are listed too, so they can rank in Google Images.
    const images = [p.imageUrl, ...(p.images ?? [])]
      .map((u) => absolute(u, origin))
      .filter((u, i, arr): u is string => !!u && arr.indexOf(u) === i)
      .slice(0, 10);
    urls.push({ loc: `${origin}${productPath(p)}`, lastmod: iso(p.updatedAt), priority: "0.8", images });
  }
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
        `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.priority ? `<priority>${u.priority}</priority>` : ""}${(u.images ?? []).map((img) => `<image:image><image:loc>${esc(img)}</image:loc></image:image>`).join("")}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
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
