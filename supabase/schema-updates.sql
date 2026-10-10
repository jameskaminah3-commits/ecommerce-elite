-- Happyfine: bring an older database up to date. Safe to run more than once.
-- Paste the whole file into Supabase → SQL Editor → Run.
-- (The API server also runs these automatically each time it starts, unless SKIP_SCHEMA_SYNC=1.)

ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_user_id integer;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_referral_code_unique') THEN ALTER TABLE users ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code); END IF; END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paystack_reference text;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_deducted boolean NOT NULL DEFAULT false;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_discount numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code_used text;

ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name text;

DO $$ BEGIN IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'rating') = 'integer' THEN ALTER TABLE reviews ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1); END IF; END $$;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id integer;

ALTER TABLE products ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';

ALTER TABLE products ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

ALTER TABLE products ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2);

ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0;

ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_class_id integer;

ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title text NOT NULL DEFAULT '';

ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description text NOT NULL DEFAULT '';

UPDATE products p SET base_price = v.min_price
  FROM (SELECT product_id, min(price) AS min_price FROM product_variants WHERE price > 0 GROUP BY product_id) v
 WHERE v.product_id = p.id AND p.base_price <> v.min_price;

ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS site_settings (
  id serial PRIMARY KEY,
  brand_blurb text NOT NULL DEFAULT '',
  about_heading text NOT NULL DEFAULT 'About us',
  about_links jsonb NOT NULL DEFAULT '[]',
  support_heading text NOT NULL DEFAULT 'Customer support',
  support_links jsonb NOT NULL DEFAULT '[]',
  contact_phone text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  live_chat_url text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  pinterest_url text NOT NULL DEFAULT '',
  tiktok_url text NOT NULL DEFAULT '',
  accepted_payments jsonb NOT NULL DEFAULT '[]',
  currency_label text NOT NULL DEFAULT 'Kenya (KES)',
  copyright_text text NOT NULL DEFAULT 'Happyfine Wholesalers',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_paybill text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_till text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_account_name text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_send_phone text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_instructions text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS referral_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS referral_discount_percent integer NOT NULL DEFAULT 0;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS mpesa_pochi_phone text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS whatsapp_number text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS welcome_discount_percent integer NOT NULL DEFAULT 10;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS welcome_code_days integer NOT NULL DEFAULT 30;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_site_verification text NOT NULL DEFAULT '';

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS online_payments_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS order_notify_emails text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS newsletter_signups (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS code text;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'newsletter_signups_code_unique') THEN ALTER TABLE newsletter_signups ADD CONSTRAINT newsletter_signups_code_unique UNIQUE (code); END IF; END $$;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS used_at timestamptz;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS used_order_id integer;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS unsubscribe_token text;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

ALTER TABLE newsletter_signups ADD COLUMN IF NOT EXISTS last_emailed_at timestamptz;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code text;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS promotions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  announcement text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Shop the deals',
  cta_href text NOT NULL DEFAULT '/products',
  theme text NOT NULL DEFAULT 'brand',
  show_countdown boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0;

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'all';

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS category_ids integer[] NOT NULL DEFAULT '{}';

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS product_ids integer[] NOT NULL DEFAULT '{}';
