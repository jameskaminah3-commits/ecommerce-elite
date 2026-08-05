import { defineConfig } from "drizzle-kit";
import path from "path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Mirror the runtime pool (lib/db/src/index.ts): when the connection requires
// SSL (Supabase pooler etc.), connect with relaxed verification. Recent `pg`
// versions treat `sslmode=require` as strict `verify-full`, which rejects the
// pooler certificate on a stock Node install and breaks `db push`.
const useSsl =
  process.env.DATABASE_SSL === "true" ||
  process.env.PGSSLMODE === "require" ||
  databaseUrl.includes("sslmode=require");

// drizzle-kit does not reliably apply the `ssl` option below, so it falls back
// to strict `verify-full` and cannot complete the TLS handshake against the
// Supabase pooler (whose cert is not in Node's default trust store). Relax
// verification at the Node level for the migration process only — this runs
// before drizzle-kit opens its connection. The runtime pool already does the
// equivalent via `rejectUnauthorized: false`.
if (useSsl) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export default defineConfig({
  // Use forward slashes even on Windows — drizzle-kit's schema file glob does
  // not treat backslashes as path separators, so a native Windows path would
  // report "No schema files found".
  schema: path.join(__dirname, "src", "schema", "index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  },
});
