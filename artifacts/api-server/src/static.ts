import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { logger } from "./lib/logger";

// Serve the built storefront (a static Vite SPA) from the same Node process as
// the API. This collapses the whole app into one service/port, which is what
// makes it deployable both on Railway (one service) and on cPanel/Passenger
// (one Node entry point) with no CORS and no second origin to configure.
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

  // SPA fallback: any non-API GET returns the app shell so client-side routing
  // works on hard refresh and deep links. API routes still 404 as JSON above.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });

  logger.info({ distDir }, "Serving storefront static build");
}
