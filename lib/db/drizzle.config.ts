import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // Use forward slashes even on Windows — drizzle-kit's schema file glob does
  // not treat backslashes as path separators, so a native Windows path would
  // report "No schema files found".
  schema: path.join(__dirname, "src", "schema", "index.ts").replace(/\\/g, "/"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
