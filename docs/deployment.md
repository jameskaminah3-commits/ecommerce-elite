# Supabase, Local Meilisearch, Railway, and GitHub Setup

This project is a PNPM monorepo. The API lives in `artifacts/api-server`, the database schema lives in `lib/db`, and the storefront lives in `artifacts/storefront`.

Your actual Git repository root is:

```powershell
C:\Users\hp\Downloads\ECommerce-Elite\ECommerce-Elite
```

Use that folder for all commands below.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard.
2. Click **New project**.
3. Choose your organization.
4. Project name: use something like `ecommerce-elite`.
5. Database password: create a long password and save it in your password manager.
6. Region: choose the closest region to your users. For Kenya/East Africa, start with a nearby Europe region such as Frankfurt if available.
7. Click **Create new project**.
8. Wait until Supabase finishes provisioning the project.

## 2. Create the database tables and RLS policies

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open `supabase/app_server_role.example.sql`, replace `replace_with_a_long_random_password`, then run it.
4. Open `supabase/migrations/202607300001_core_schema_rls.sql` and run it.
5. Go to Project Settings > Database > Connection string.
6. Use the pooler connection string for app traffic. For Supavisor, the username format is `<db-user>.<project-ref>`, for example `app_server.abcdxyz`.
7. Put that URL in `DATABASE_URL` and keep `DATABASE_SSL=true`.

RLS is enabled and forced for `categories`, `users`, `products`, `product_variants`, `inventory`, `cart_items`, `orders`, and `order_items`.

Important: the server should connect as `app_server` if you want RLS enforced for the API. The default `postgres` user is powerful and can bypass RLS protections.

## 3. Test Meilisearch locally first

The easiest local path on Windows is Docker Desktop.

1. Install and open Docker Desktop.
2. In PowerShell, go to the project root:

```powershell
cd C:\Users\hp\Downloads\ECommerce-Elite\ECommerce-Elite
```

3. Start Meilisearch locally:

```powershell
docker run --rm -it `
  -p 7700:7700 `
  -e MEILI_ENV=development `
  -e MEILI_MASTER_KEY=local_dev_master_key_123 `
  -v ${PWD}\meili_data:/meili_data `
  getmeili/meilisearch:v1.37
```

4. Open http://localhost:7700 in your browser. You should see a small JSON response from Meilisearch.
5. In a second PowerShell window, set your local variables:

```powershell
$env:PORT="3000"
$env:NODE_ENV="development"
$env:DATABASE_URL="<your Supabase app_server pooler URL>"
$env:DATABASE_SSL="true"
$env:MEILISEARCH_HOST="http://localhost:7700"
$env:MEILISEARCH_API_KEY="local_dev_master_key_123"
$env:MEILISEARCH_PRODUCTS_INDEX="products"
```

6. Build and start the API:

```powershell
cmd /c pnpm approve-builds
cmd /c pnpm build:api
cmd /c pnpm start:api
```

When `pnpm approve-builds` opens a prompt, approve `esbuild`.

7. In a third PowerShell window, sync products into Meilisearch:

```powershell
$env:DATABASE_URL="<your Supabase app_server pooler URL>"
$env:DATABASE_SSL="true"
$env:MEILISEARCH_HOST="http://localhost:7700"
$env:MEILISEARCH_API_KEY="local_dev_master_key_123"
$env:MEILISEARCH_PRODUCTS_INDEX="products"
cmd /c pnpm search:sync
```

8. Test search through the API:

```powershell
curl "http://localhost:3000/api/products?search=test"
```

If Meilisearch is not running, the API falls back to Postgres search.

## 4. Production Meilisearch on Railway

1. In Railway, create a new service from a Docker image.
2. Use the image `getmeili/meilisearch:latest`.
3. Add these variables to that Meilisearch service:

```bash
MEILI_ENV=production
MEILI_MASTER_KEY=<make-this-at-least-16-bytes>
```

4. Generate a Railway domain for the Meilisearch service.
5. In the API service, add:

```bash
MEILISEARCH_HOST=https://<your-meilisearch-domain>
MEILISEARCH_API_KEY=<same-value-as-MEILI_MASTER_KEY>
MEILISEARCH_PRODUCTS_INDEX=products
```

6. After the API can connect to Supabase and Meilisearch, run:

```bash
pnpm search:sync
```

The API uses Meilisearch for product search only when `MEILISEARCH_HOST` and `MEILISEARCH_API_KEY` are present. Without them, it falls back to Postgres search.

## 5. Railway API service

1. Push this repository to GitHub.
2. In Railway, create a project from the GitHub repo.
3. Select the API service or create one from the repo root.
4. Keep the root directory as `/`.
5. Railway will read `railway.json`, which sets:

```bash
Build Command: pnpm --filter @workspace/api-server build
Start Command: pnpm --filter @workspace/api-server start
Healthcheck: /api/healthz
```

6. Add these API variables in Railway:

```bash
NODE_ENV=production
PORT=${{PORT}}
DATABASE_URL=<your Supabase app_server pooler URL>
DATABASE_SSL=true
MEILISEARCH_HOST=<your Meilisearch URL>
MEILISEARCH_API_KEY=<your Meilisearch key>
MEILISEARCH_PRODUCTS_INDEX=products
LOG_LEVEL=info
```

## 6. Create the GitHub repo and push

Use the inner project folder as the root. Do not push from `C:\Users\hp\Downloads\ECommerce-Elite`; push from `C:\Users\hp\Downloads\ECommerce-Elite\ECommerce-Elite`.

1. Create an empty repo on GitHub:

- Go to https://github.com/new.
- Repository name: `ECommerce-Elite` or any name you want.
- Choose Private while you are setting up payments and database secrets.
- Do not add a README, `.gitignore`, or license from GitHub because this local repo already exists.
- Click **Create repository**.

2. Back in PowerShell:

```powershell
cd C:\Users\hp\Downloads\ECommerce-Elite\ECommerce-Elite
git status
```

3. Stage only the deployment/database/search work:

```bash
git add .env.example docs/deployment.md railway.json supabase lib/db/src artifacts/api-server/src scripts package.json pnpm-lock.yaml
git commit -m "Prepare Supabase RLS and Railway Meilisearch deployment"
```

4. Add GitHub as `origin`. Replace the URL with your repo URL:

```powershell
git remote add origin https://github.com/<your-username>/<your-repo>.git
```

If `origin` already exists later, use:

```powershell
git remote set-url origin https://github.com/<your-username>/<your-repo>.git
```

5. Push:

```powershell
git branch -M main
git push -u origin main
```

If Git asks you to log in, use GitHub's browser login or a personal access token.

## 7. Beginner checklist

- Supabase project exists.
- `app_server` role was created.
- Core SQL migration was run.
- Local Meilisearch responds at `http://localhost:7700`.
- API starts locally with `PORT=3000`.
- `pnpm search:sync` queues products into Meilisearch.
- GitHub repo exists and `origin` points to it.
- Railway API service has Supabase and Meilisearch environment variables.

## 8. Production security notes

This app still has a simple local cookie login and SHA-256 password hashing. Before real customers use it, replace that with Supabase Auth or a hardened auth system using bcrypt/argon2, secure sessions, CSRF protections for cookie-based writes, and admin middleware on admin routes.
