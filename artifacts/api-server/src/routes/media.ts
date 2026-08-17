import express, { Router, type IRouter } from "express";
import crypto from "crypto";
import { requireAdmin } from "../middlewares/requireAdmin";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const BUCKET = process.env["SUPABASE_STORAGE_BUCKET"] ?? "media";
const UPLOAD_PREFIX = "products";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

const TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

// Derive an extension from a filename (e.g. "photo.WEBP" → "webp"). Some
// browsers/OSes report an empty File.type for webp/avif, so the filename is a
// reliable secondary signal.
function extFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  return TYPE_BY_EXT[ext] ? ext : null;
}

// Last-resort detection: inspect the file's magic bytes. This makes uploads
// work even when the Content-Type header and filename are both missing or
// wrong — the bytes never lie.
function sniffExt(body: Buffer): string | null {
  if (body.length < 12) return null;
  // PNG  \x89 P N G
  if (body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) return "png";
  // JPEG \xFF \xD8 \xFF
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "jpg";
  // GIF  G I F
  if (body[0] === 0x47 && body[1] === 0x49 && body[2] === 0x46) return "gif";
  // WEBP "RIFF" .... "WEBP"
  if (
    body[0] === 0x52 && body[1] === 0x49 && body[2] === 0x46 && body[3] === 0x46 &&
    body[8] === 0x57 && body[9] === 0x45 && body[10] === 0x42 && body[11] === 0x50
  ) return "webp";
  // AVIF/HEIC "ftyp" box with an avif/avis/heic brand
  if (body[4] === 0x66 && body[5] === 0x74 && body[6] === 0x79 && body[7] === 0x70) {
    const brand = body.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "avif";
  }
  // SVG (text) — starts with "<?xml" or "<svg"
  const head = body.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) return "svg";
  return null;
}

interface StorageConfig {
  url: string;
  key: string;
}

function storageConfig(): StorageConfig | null {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), key };
}

function publicUrl(cfg: StorageConfig, path: string): string {
  return `${cfg.url}/storage/v1/object/public/${BUCKET}/${path}`;
}

// Create the storage bucket on first use so setup is just two env vars. Safe to
// call repeatedly — an existing bucket returns a conflict which we ignore.
let bucketReady = false;
async function ensureBucket(cfg: StorageConfig): Promise<void> {
  if (bucketReady) return;
  const resp = await fetch(`${cfg.url}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (resp.ok || resp.status === 409) {
    bucketReady = true;
    return;
  }
  const text = await resp.text().catch(() => "");
  // A "already exists" style error also means we are good to go.
  if (text.toLowerCase().includes("exist")) {
    bucketReady = true;
    return;
  }
  logger.warn({ status: resp.status, text }, "Could not ensure storage bucket");
}

// Upload a single image. The raw file bytes are sent as the request body with
// the image's Content-Type; multipart is intentionally avoided to keep the
// dependency surface small.
router.post(
  "/media/upload",
  requireAdmin,
  express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
  async (req, res): Promise<void> => {
    const cfg = storageConfig();
    if (!cfg) {
      res.status(503).json({
        error: "Media storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      });
      return;
    }

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Empty upload." });
      return;
    }

    // Resolve the image type from three signals, most trusted first:
    // 1) the request Content-Type, 2) the original filename, 3) magic bytes.
    // Any one of them is enough, so a browser that omits the webp/avif MIME
    // type (a common quirk) still uploads fine.
    const contentType = (req.headers["content-type"] ?? "").toLowerCase().split(";")[0].trim();
    const fileNameHeader = String(req.headers["x-file-name"] ?? "");
    const ext = EXT_BY_TYPE[contentType] ?? extFromName(fileNameHeader) ?? sniffExt(body);
    if (!ext) {
      res.status(400).json({ error: "Unsupported image type. Use PNG, JPG, WEBP, GIF, AVIF or SVG." });
      return;
    }
    const storeContentType = TYPE_BY_EXT[ext] ?? "application/octet-stream";

    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
    const path = `${UPLOAD_PREFIX}/${filename}`;

    try {
      await ensureBucket(cfg);
      const uploadRes = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": storeContentType,
          "cache-control": "3600",
          "x-upsert": "true",
        },
        body,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text().catch(() => "");
        logger.error({ status: uploadRes.status, text }, "Supabase storage upload failed");
        res.status(502).json({ error: "Upload to storage failed.", detail: text.slice(0, 200) });
        return;
      }

      res.status(201).json({ url: publicUrl(cfg, path), path, name: filename });
    } catch (err) {
      logger.error({ err }, "Could not reach Supabase storage");
      res.status(502).json({ error: "Could not reach storage service." });
    }
  },
);

// List previously uploaded images so they can be reused.
router.get("/media", requireAdmin, async (_req, res): Promise<void> => {
  const cfg = storageConfig();
  if (!cfg) {
    res.json({ items: [] });
    return;
  }

  try {
    const listRes = await fetch(`${cfg.url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prefix: `${UPLOAD_PREFIX}/`,
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      }),
    });

    if (!listRes.ok) {
      res.json({ items: [] });
      return;
    }

    const objects = (await listRes.json()) as Array<{ name?: string }>;
    const items = objects
      .filter((o) => o.name && !o.name.endsWith("/"))
      .map((o) => ({ name: o.name as string, url: publicUrl(cfg, `${UPLOAD_PREFIX}/${o.name}`) }));

    res.json({ items });
  } catch (err) {
    logger.error({ err }, "Could not list media");
    res.json({ items: [] });
  }
});

// Remove an image from the library.
router.delete("/media", requireAdmin, async (req, res): Promise<void> => {
  const cfg = storageConfig();
  if (!cfg) {
    res.status(503).json({ error: "Media storage is not configured." });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  if (!name || name.includes("/") || name.includes("..")) {
    res.status(400).json({ error: "Invalid file name." });
    return;
  }
  try {
    const delRes = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${UPLOAD_PREFIX}/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.key}` },
    });
    if (!delRes.ok) {
      res.status(502).json({ error: "Failed to delete image." });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    logger.error({ err }, "Could not delete media");
    res.status(502).json({ error: "Could not reach storage service." });
  }
});

export default router;
