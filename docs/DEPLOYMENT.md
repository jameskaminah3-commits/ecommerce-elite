# Deployment

The app runs as **one Node process** that serves both the API (`/api/*`) and
the built storefront SPA (everything else) from the **same origin**. That means:

- No CORS to configure, no second domain, no `VITE_API_BASE_URL` to set — the
  browser talks to `/api` on the same host it loaded from.
- One service on Railway; one Passenger app on cPanel.

The only external dependency for a review deploy is a **Postgres database**
(Supabase). Meilisearch is optional — search automatically falls back to
Postgres when it isn't configured.

---

## Part 1 — Railway (for client review)

### 1. Push this branch to GitHub
Already done — the repo contains `railway.json`, which tells Railway to:
- **build:** `pnpm run build:deploy` (builds the SPA, then bundles the API)
- **start:** `pnpm --filter @workspace/api-server start`
- **health check:** `/api/healthz`

### 2. Create the Railway service
1. In [Railway](https://railway.app) → **New Project → Deploy from GitHub repo**
   and pick `jameskaminah3-commits/ecommerce-elite`.
2. In **Settings → Environment**, set the deploy branch to
   `claude/ecommerce-review-5stce1` (or merge to `main` first and deploy that).
3. Railway auto-detects `railway.json`. No Dockerfile needed.

### 3. Set environment variables (service → Variables)
| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | a long random string — `openssl rand -hex 32` |
| `DATABASE_URL` | Supabase **pooler** URL, e.g. `postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require` |
| `DATABASE_SSL` | `true` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key (Supabase → Project Settings → API) |
| `SUPABASE_STORAGE_BUCKET` | `media` |

Do **not** set `PORT` — Railway injects it. Leave `VITE_API_BASE_URL` and
`CORS_ORIGINS` unset (same-origin). Leave the Meilisearch vars unset to use
Postgres search.

> ⚠️ Rotate the Supabase password and service-role key that were shared in
> chat earlier — treat them as compromised.

### 4. Prepare the database (once)
Point `DATABASE_URL` at your Supabase project, then from your machine:
```bash
export DATABASE_URL="…the same pooler URL…"
export DATABASE_SSL=true
pnpm db:push        # create/update all tables
pnpm seed:local     # optional: demo catalogue
```
(On Windows PowerShell use `$env:DATABASE_URL="…"` / `$env:DATABASE_SSL="true"`.)

### 5. Deploy & verify
Railway builds and starts automatically. When the health check passes:
- `https://<app>.up.railway.app/` → storefront
- `https://<app>.up.railway.app/admin` → admin dashboard
- `https://<app>.up.railway.app/api/healthz` → `{"status":"ok"}`

Share the Railway URL with the client for review.

---

## Part 2 — cPanel / Hostpinnacle (final hosting)

cPanel uses **Phusion Passenger**, which runs a single flat Node app and can't
build a pnpm monorepo. So you **build locally and upload a self-contained
bundle**.

### 1. Build the portable bundle (on your machine, Linux/macOS/WSL)
```bash
pnpm install
pnpm run build:deploy
bash scripts/make-cpanel-bundle.sh
```
This produces `deploy/cpanel/` — a flat folder with `index.mjs`, its worker
files, `public/` (the SPA), and a minimal `package.json`. Everything is
bundled, so **no `npm install` is needed on the server**.

### 2. Upload it
Zip `deploy/cpanel/` and upload it via cPanel **File Manager** (or Git) into a
folder in your home dir, e.g. `~/happyfine`. Extract so that `index.mjs` and
`public/` sit directly in `~/happyfine`.

### 3. Create the Node.js app
cPanel → **Setup Node.js App → Create Application**:
- **Node version:** 20.x (or 18.x)
- **Application mode:** Production
- **Application root:** `happyfine`
- **Application URL:** your domain/subdomain
- **Application startup file:** `index.mjs`

### 4. Set environment variables (in the same screen)
Add the same variables as Railway **except `PORT`** (Passenger manages it):
`NODE_ENV=production`, `SESSION_SECRET`, `DATABASE_URL`, `DATABASE_SSL=true`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=media`,
and — because the layout is flat — the absolute static path:
```
STOREFRONT_DIST=/home/<cpaneluser>/happyfine/public
```
(`deploy/cpanel/.env.example` lists these too.)

### 5. Start
Click **Restart**. Passenger boots `index.mjs`, which serves the API and the
SPA on your domain. Visit `https://yourdomain/api/healthz` to confirm.

### Redeploying
Rebuild locally (`pnpm run build:deploy && bash scripts/make-cpanel-bundle.sh`),
re-upload `deploy/cpanel/`, and hit **Restart** in cPanel.

---

## Notes
- **Database:** Supabase is reached over the network from any host, so the same
  DB backs both Railway and cPanel. Run `pnpm db:push` whenever the schema
  changes.
- **Images:** uploads go to Supabase Storage via the service-role key, so they
  work identically on both platforms.
- **Custom domain on Railway:** Settings → Networking → Custom Domain, then
  point DNS at the given target. No app change required (same-origin).
- **Meilisearch (optional, later):** set `MEILISEARCH_HOST` + `MEILISEARCH_API_KEY`
  and run `pnpm search:sync` to index; otherwise Postgres search is used.
