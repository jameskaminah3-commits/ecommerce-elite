import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
