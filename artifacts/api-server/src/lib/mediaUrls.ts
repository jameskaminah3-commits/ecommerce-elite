import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Product photos live in Supabase Storage, but shoppers load them from the shop's
// own address: /media/<path>. The server fetches each file with its service key,
// so photos display whether or not the storage bucket is public — and Cloudflare
// caches them close to customers. Older Supabase "public" links are rewritten to
// /media/... automatically wherever the API returns them.

export const MEDIA_BUCKET = process.env["SUPABASE_STORAGE_BUCKET"] ?? "media";

/**
 * SUPABASE_URL exactly as Supabase shows it is https://<project>.supabase.co, but a
 * typo like "https:/<project>…" or a missing "https://" still works for the server
 * while producing photo links browsers can't open. Normalise it to a clean origin.
 */
export function supabaseBase(): string {
  const raw = (process.env["SUPABASE_URL"] ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/^(https?):\/*(.*)$/i);
  const scheme = m ? m[1].toLowerCase() : "https";
  const rest = m ? m[2] : raw;
  try {
    return new URL(`${scheme}://${rest}`).origin;
  } catch {
    return "";
  }
}

// Any form of a Supabase public storage link — with "https://", a broken "https:/",
// or no scheme at all: <host>/storage/v1/object/public/<bucket>/<path>
const PUBLIC_LINK = /^(?:https?:\/*)?(?:[a-z0-9.-]+)?\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/i;

export function toShopMediaUrl(url: string): string {
  const m = url.match(PUBLIC_LINK);
  if (!m || m[1] !== MEDIA_BUCKET) return url;
  return `/media/${m[2]}`;
}

function rewrite(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.includes("/storage/v1/object/public/") ? toShopMediaUrl(value) : value;
  }
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => rewrite(v, depth + 1));
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = rewrite(v, depth + 1);
  return out;
}

/** Rewrites Supabase public photo links in every JSON API response. */
export function rewriteMediaLinks(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = ((body: unknown) => json(rewrite(body))) as Response["json"];
  next();
}

const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,300}$/;

/** GET /media/<path> — stream a stored photo (works for private buckets). */
export async function serveMedia(req: Request, res: Response): Promise<void> {
  const path = String((req.params as Record<string, string>)[0] ?? "");
  const base = supabaseBase();
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  if (!SAFE_PATH.test(path) || path.includes("..") || !base || !key) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  try {
    const upstream = await fetch(`${base}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (!upstream.ok || !upstream.body) {
      if (upstream.status >= 500) logger.warn({ status: upstream.status, path }, "Media fetch failed");
      res.status(upstream.status === 400 || upstream.status === 404 ? 404 : 502).type("text/plain").send("Not found");
      return;
    }
    const type = upstream.headers.get("content-type") ?? "application/octet-stream";
    if (!/^image\//i.test(type)) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Content-Type", type);
    const len = upstream.headers.get("content-length");
    if (len) res.setHeader("Content-Length", len);
    // File names are unique per upload, so they can be cached for a long time.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (err) {
    logger.error({ err, path }, "Media proxy error");
    res.status(502).type("text/plain").send("Image temporarily unavailable");
  }
}

/**
 * A photo link saved without its https:// shows up as a page on our own site, e.g.
 * /gqhon….supabase.co/storage/v1/object/public/media/products/x.jpg — send those
 * straight to the real photo.
 */
export const BROKEN_LINK_PATH = /^\/[a-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export function redirectBrokenMediaLink(req: Request, res: Response, next: NextFunction): void {
  const m = req.path.match(BROKEN_LINK_PATH);
  if (!m || m[1] !== MEDIA_BUCKET) return next();
  res.redirect(301, `/media/${m[2]}`);
}

/** SQL that turns any saved Supabase public link (well-formed or not) into /media/... */
export function repairMediaLinksSql(): string[] {
  const pattern = `'^.*/storage/v1/object/public/${MEDIA_BUCKET.replace(/[^A-Za-z0-9_-]/g, "")}/'`;
  const fix = (col: string) => `regexp_replace(${col}, ${pattern}, '/media/')`;
  const where = (col: string) => `${col} LIKE '%/storage/v1/object/public/%'`;
  const textCols: [string, string][] = [
    ["products", "image_url"],
    ["product_variants", "image_url"],
    ["categories", "image_url"],
    ["homepage_blocks", "image_url"],
    ["blog_posts", "cover_image_url"],
    ["order_items", "product_image_url"],
  ];
  return [
    ...textCols.map(([t, c]) => `UPDATE ${t} SET ${c} = ${fix(c)} WHERE ${where(c)}`),
    `UPDATE products SET images = ARRAY(SELECT ${fix("u")} FROM unnest(images) WITH ORDINALITY AS t(u, i) ORDER BY i)
      WHERE array_to_string(images, ' ') LIKE '%/storage/v1/object/public/%'`,
  ];
}
