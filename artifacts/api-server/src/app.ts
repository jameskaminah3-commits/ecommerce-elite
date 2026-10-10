import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { mountStorefront } from "./static";
import { logger } from "./lib/logger";

const app: Express = express();

// Behind Railway / cPanel the app sits behind a TLS-terminating proxy. Trusting
// it makes req.protocol / req.get("host") reflect the public URL, which the
// share-preview tags and sitemap depend on.
app.set("trust proxy", 1);

// One address for the shop: visitors (and Google) who arrive on www.<domain> are
// sent permanently to the PUBLIC_URL address, path and query kept. A safety net
// behind any Cloudflare/DNS redirect rule. Only the www twin of the canonical host
// is redirected, so health checks and internal hosts are never affected.
const canonical = (() => {
  try {
    const u = new URL((process.env["PUBLIC_URL"] ?? "").trim());
    return { origin: u.origin, host: u.host.toLowerCase() };
  } catch {
    return null;
  }
})();
if (canonical) {
  const twin = canonical.host.startsWith("www.") ? canonical.host.slice(4) : `www.${canonical.host}`;
  app.use((req, res, next) => {
    const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim().toLowerCase();
    if (host !== twin || (req.method !== "GET" && req.method !== "HEAD")) return next();
    res.redirect(301, `${canonical.origin}${req.originalUrl}`);
  });
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// Restrict CORS to an explicit allowlist when configured; reflect the origin
// only in local dev. Credentials are allowed either way.
const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : true, credentials: true }));

// Sign cookies so the session cookie cannot be forged. A secret is mandatory
// in production; a clearly-insecure fallback is used only for local dev.
const cookieSecret = process.env["SESSION_SECRET"];
if (!cookieSecret && process.env["NODE_ENV"] === "production") {
  throw new Error("SESSION_SECRET must be set in production to sign session cookies.");
}
app.use(cookieParser(cookieSecret || "happyfine-dev-secret-do-not-use-in-production"));
// Keep the raw body around so webhook handlers (e.g. Paystack) can verify the
// HMAC signature over the exact bytes we received.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production, this same process also serves the built storefront SPA
// (no-op when the build isn't present, e.g. API-only local dev).
mountStorefront(app);

export default app;
