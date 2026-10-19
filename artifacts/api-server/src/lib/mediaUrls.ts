import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// Product photos live in Supabase Storage, but shoppers load them from the shop's
// own address: /media/<path>. The server fetches each file with its service key,
// so photos display whether or not the storage bucket is public — and Cloudflare
// caches them close to customers. Older Supabase "public" links are rewritten to
// /media/... automatically wherever the API returns them.

export const MEDIA_BUCKET = process.env["SUPABASE_STORAGE_BUCKET"] ?? "media";

// https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
const PUBLIC_LINK = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/([^/?#]+)\/([^?#]+)/i;

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
  const base = (process.env["SUPABASE_URL"] ?? "").replace(/\/+$/, "");
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
