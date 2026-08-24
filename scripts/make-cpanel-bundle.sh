#!/usr/bin/env bash
# Assemble a self-contained bundle for cPanel / Passenger (Hostpinnacle).
#
# cPanel's "Setup Node.js App" runs ONE flat Node application, not a pnpm
# workspace, and shared hosting usually can't run the monorepo build. So we
# build here and package a portable folder you upload as the Application root.
#
# Usage (run from the repo root, on Linux/macOS/WSL):
#   pnpm run build:deploy
#   bash scripts/make-cpanel-bundle.sh
#
# Result: deploy/cpanel/  — zip it and upload, or push it to the app's Git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/cpanel"
API_DIST="$ROOT/artifacts/api-server/dist"
WEB_DIST="$ROOT/artifacts/storefront/dist/public"

if [ ! -f "$API_DIST/index.mjs" ] || [ ! -f "$WEB_DIST/index.html" ]; then
  echo "Build output missing. Run 'pnpm run build:deploy' first." >&2
  exit 1
fi

rm -rf "$OUT"
mkdir -p "$OUT/public"

# API bundle + its sibling pino worker files (already self-contained).
cp "$API_DIST"/*.mjs "$OUT/"
# Storefront static build.
cp -r "$WEB_DIST/." "$OUT/public/"

# Minimal package.json so Passenger treats index.mjs as an ESM app and needs
# no dependency install (everything is bundled).
cat > "$OUT/package.json" <<'JSON'
{
  "name": "happyfine",
  "private": true,
  "type": "module",
  "main": "index.mjs",
  "scripts": {
    "start": "node index.mjs"
  }
}
JSON

# A ready-to-edit env file. cPanel's UI is the source of truth for env vars,
# but this documents exactly what to set.
cat > "$OUT/.env.example" <<'ENV'
NODE_ENV=production
# Passenger sets PORT itself — do not hardcode it in cPanel.
SESSION_SECRET=replace_with_a_long_random_secret
DATABASE_URL=postgres://app_server.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_SSL=true
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace_with_service_role_key
SUPABASE_STORAGE_BUCKET=media
# Absolute path to the uploaded static build (adjust the cPanel username/path):
STOREFRONT_DIST=/home/<cpaneluser>/happyfine/public
# Same-origin, so no CORS host is needed. Meilisearch is optional.
ENV

echo "Bundle ready: $OUT"
( cd "$OUT" && du -sh . && echo "files:" && ls )
