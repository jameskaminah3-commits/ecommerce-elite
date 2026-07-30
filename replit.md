# Happyfine Wholesalers

A premium full-stack wholesale e-commerce platform for the Kenyan market.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (`artifacts/storefront`) |
| Backend API | Express 5 (`artifacts/api-server`) |
| Database | Replit PostgreSQL via Drizzle ORM (`lib/db`) |
| API Client | Orval-generated React Query hooks (`lib/api-client-react`) |
| API Spec | OpenAPI 3.1 (`lib/api-spec/openapi.yaml`) |

## Product Categories
Home & Living, Electronics, Decor, Fashion, Beauty, Gym & Fitness

## Running the App

All workflows are managed by Replit:
- **Storefront** — `artifacts/storefront: web`
- **API Server** — `artifacts/api-server: API Server`

## Default Credentials (development seed)

| Role | Email | Password hash note |
|---|---|---|
| Admin | admin@happyfine.co.ke | SHA-256 of "password" (swap for bcrypt in production) |
| Customer | jane@example.com | SHA-256 of "password" |

> **Production:** Replace `sha256` hashing in `artifacts/api-server/src/routes/auth.ts` with `bcrypt` before going live.

## Payment Integrations (Stubs)

Both payment methods are **stubs** — routes are wired and return valid responses but real API calls are commented out.

### M-Pesa (Daraja STK Push)
- Route: `POST /api/payments/mpesa/stkpush`
- Activate by setting these secrets and uncommenting the Daraja code in `artifacts/api-server/src/routes/payments.ts`:
  - `MPESA_CONSUMER_KEY`
  - `MPESA_CONSUMER_SECRET`
  - `MPESA_SHORTCODE`
  - `MPESA_PASSKEY`
  - `MPESA_CALLBACK_URL`

### Pesapal
- Route: `POST /api/payments/pesapal`
- Activate by setting:
  - `PESAPAL_CONSUMER_KEY`
  - `PESAPAL_CONSUMER_SECRET`

## Regenerating the API Client

After editing `lib/api-spec/openapi.yaml`, run:
```bash
pnpm --filter @workspace/api-client-react run generate
```

## Future Migration to Supabase
The database layer is fully abstracted via Drizzle ORM. To migrate:
1. Set `DATABASE_URL` to your Supabase connection string
2. Run `pnpm --filter @workspace/db run db:push`

## User Preferences
- Currency displayed as KES (Kenyan Shilling)
- No emojis in the UI
- Premium, professional design aesthetic
