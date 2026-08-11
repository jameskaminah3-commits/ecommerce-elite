import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, blogPostsTable, productsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Post = typeof blogPostsTable.$inferSelect;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || `post-${Date.now()}`;
}

function toPublic(p: Post) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    coverImageUrl: p.coverImageUrl,
    author: p.author,
    tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    status: p.status,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// Whitelist + normalize writable fields.
function sanitize(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof body?.title === "string") out.title = body.title.trim().slice(0, 200);
  if (typeof body?.slug === "string" && body.slug.trim()) out.slug = slugify(body.slug);
  if ("excerpt" in body) out.excerpt = body.excerpt ? String(body.excerpt).slice(0, 400) : null;
  if ("content" in body) out.content = String(body.content ?? "");
  if ("coverImageUrl" in body) out.coverImageUrl = body.coverImageUrl || null;
  if (typeof body?.author === "string" && body.author.trim()) out.author = body.author.trim().slice(0, 120);
  if ("tags" in body) {
    out.tags = Array.isArray(body.tags)
      ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean).join(",")
      : (body.tags ? String(body.tags) : null);
  }
  if (body?.status === "draft" || body?.status === "published") out.status = body.status;
  if ("metaTitle" in body) out.metaTitle = body.metaTitle ? String(body.metaTitle).slice(0, 200) : null;
  if ("metaDescription" in body) out.metaDescription = body.metaDescription ? String(body.metaDescription).slice(0, 320) : null;
  return out;
}

// ── Public: list published posts ──────────────────────────────────────────
router.get("/blog-posts", async (req, res): Promise<void> => {
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "9"), 10) || 9, 1), 50);
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;

  const conditions = [eq(blogPostsTable.status, "published")];
  if (tag) conditions.push(sql`${blogPostsTable.tags} ilike ${"%" + tag + "%"}`);

  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(blogPostsTable)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(blogPostsTable)
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${blogPostsTable.publishedAt}, ${blogPostsTable.createdAt})`))
    .limit(limit)
    .offset((page - 1) * limit);

  res.json({ items: rows.map(toPublic), total: count, page, limit });
});

// ── Public: a single published post by slug ───────────────────────────────
router.get("/blog-posts/:slug", async (req, res): Promise<void> => {
  const slug = String(req.params.slug);
  const [post] = await db
    .select()
    .from(blogPostsTable)
    .where(and(eq(blogPostsTable.slug, slug), eq(blogPostsTable.status, "published")));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(toPublic(post));
});

// ── Admin: all posts (incl. drafts) ───────────────────────────────────────
router.get("/admin/blog-posts", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db.select().from(blogPostsTable).orderBy(desc(blogPostsTable.updatedAt));
  res.json(rows.map(toPublic));
});

router.post("/blog-posts", requireAdmin, async (req, res): Promise<void> => {
  const data = sanitize(req.body ?? {});
  if (!data.title) {
    res.status(400).json({ error: "A title is required." });
    return;
  }
  if (!data.slug) data.slug = slugify(String(data.title));
  // Publishing for the first time sets publishedAt.
  if (data.status === "published") data.publishedAt = new Date();
  try {
    const [row] = await db.insert(blogPostsTable).values(data as any).returning();
    res.status(201).json(toPublic(row));
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(409).json({ error: "A post with that slug already exists." });
    } else {
      logger.error({ err }, "Failed to create blog post");
      res.status(500).json({ error: "Failed to create post." });
    }
  }
});

router.patch("/blog-posts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [existing] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  const data = sanitize(req.body ?? {});
  // Stamp publishedAt the first time a post goes live.
  if (data.status === "published" && existing.status !== "published" && !existing.publishedAt) {
    data.publishedAt = new Date();
  }
  try {
    const [row] = await db.update(blogPostsTable).set(data).where(eq(blogPostsTable.id, id)).returning();
    res.json(toPublic(row));
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(409).json({ error: "A post with that slug already exists." });
    } else {
      logger.error({ err }, "Failed to update blog post");
      res.status(500).json({ error: "Failed to update post." });
    }
  }
});

router.delete("/blog-posts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
  res.sendStatus(204);
});

// ── SEO: XML sitemap (products + published posts + key pages) ──────────────
router.get("/sitemap.xml", async (_req, res): Promise<void> => {
  const site = (process.env["SITE_URL"] ?? "https://happyfine.co.ke").replace(/\/+$/, "");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const posts = await db
    .select({ slug: blogPostsTable.slug, updatedAt: blogPostsTable.updatedAt })
    .from(blogPostsTable)
    .where(eq(blogPostsTable.status, "published"));
  const products = await db
    .select({ id: productsTable.id, updatedAt: productsTable.updatedAt })
    .from(productsTable)
    .where(eq(productsTable.status, "active"));

  const urls: string[] = [
    `<url><loc>${site}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${site}/products</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${site}/blog</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...products.map(
      (p) => `<url><loc>${site}/products/${p.id}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><priority>0.8</priority></url>`,
    ),
    ...posts.map(
      (p) => `<url><loc>${site}/blog/${esc(p.slug)}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod><priority>0.6</priority></url>`,
    ),
  ];

  res.set("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
});

export default router;
