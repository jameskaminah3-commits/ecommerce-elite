import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "./lib/logger";
import { buildRobots, buildSitemap, metaForPath, publicOrigin, renderHead } from "./seo";

// Serve the built storefront (a static Vite SPA) from the same Node process as
// the API. This collapses the whole app into one service/port, which is what
// makes it deployable both on Railway (one service) and on cPanel/Passenger
// (one Node entry point) with no CORS and no second origin to configure.
//
// The HTML shell is rendered per request so every page carries its own title,
// description and Open Graph/Twitter card — that is what makes a shared product
// link show a rich preview in WhatsApp, Facebook, X and Telegram.
//
// It is a no-op when the build is absent (e.g. running the API alone in dev),
// so importing it is always safe.
export function mountStorefront(app: Express): void {
  const here = path.dirname(fileURLToPath(import.meta.url));

  // Default to the monorepo layout relative to the bundled server
  // (dist/index.mjs → ../../storefront/dist/public). Override with
  // STOREFRONT_DIST when the deploy layout differs.
  const distDir =
    process.env["STOREFRONT_DIST"] ??
    path.resolve(here, "..", "..", "storefront", "dist", "public");

  const indexHtml = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    logger.warn({ distDir }, "Storefront build not found — serving API only");
    return;
  }
  const template = fs.readFileSync(indexHtml, "utf8");

  // Crawler-facing files, generated from the live catalogue.
  app.get("/sitemap.xml", async (req, res) => {
    try {
      res.type("application/xml").set("Cache-Control", "public, max-age=3600").send(await buildSitemap(publicOrigin(req)));
    } catch (err) {
      logger.error({ err }, "sitemap failed");
      res.status(500).type("text/plain").send("Sitemap unavailable");
    }
  });
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(buildRobots(publicOrigin(req)));
  });

  // Fingerprinted assets can be cached forever; the HTML shell must always be
  // revalidated so a new deploy is picked up immediately.
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html")) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // SPA fallback: any non-API GET returns the app shell (with this page's
  // metadata) so client-side routing works on hard refresh and deep links. API
  // routes still 404 as JSON above.
  app.use(async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    const origin = publicOrigin(req);
    let html = template;
    try {
      const meta = await metaForPath(req.path, req.query as Record<string, unknown>, origin);
      html = renderHead(template, meta, origin);
    } catch (err) {
      logger.error({ err, path: req.path }, "meta render failed — serving plain shell");
    }
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(html);
  });

  logger.info({ distDir }, "Serving storefront static build");
}
