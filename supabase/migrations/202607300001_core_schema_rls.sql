begin;

create table if not exists public.categories (
  id serial primary key,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id serial primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'warehouse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id serial primary key,
  name text not null,
  slug text not null unique,
  description text,
  base_price numeric(12, 2) not null,
  compare_at_price numeric(12, 2),
  category_id integer not null references public.categories(id),
  image_url text,
  images text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive', 'draft')),
  featured boolean not null default false,
  rating numeric(3, 2),
  review_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id serial primary key,
  product_id integer not null references public.products(id) on delete cascade,
  sku text not null unique,
  size text,
  color text,
  material text,
  price numeric(12, 2) not null,
  stock integer not null default 0,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory (
  id serial primary key,
  variant_id integer not null unique references public.product_variants(id) on delete cascade,
  quantity_on_hand integer not null default 0,
  quantity_reserved integer not null default 0,
  low_stock_threshold integer not null default 5,
  location text not null default 'default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_quantities_not_negative check (quantity_on_hand >= 0 and quantity_reserved >= 0),
  constraint inventory_reserved_not_above_on_hand check (quantity_reserved <= quantity_on_hand)
);

create table if not exists public.cart_items (
  id serial primary key,
  session_id text not null,
  variant_id integer not null references public.product_variants(id),
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id serial primary key,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  shipping_address text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method text check (payment_method in ('mpesa', 'pesapal', 'cash_on_delivery')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  total numeric(12, 2) not null,
  mpesa_checkout_request_id text,
  paid_at timestamptz,
  user_id integer references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id serial primary key,
  order_id integer not null references public.orders(id) on delete cascade,
  variant_id integer not null references public.product_variants(id),
  product_name text not null,
  product_image_url text,
  variant_sku text not null,
  variant_size text,
  variant_color text,
  price numeric(12, 2) not null,
  quantity integer not null,
  subtotal numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_status_idx on public.products(status);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists inventory_variant_id_idx on public.inventory(variant_id);
create index if not exists cart_items_session_id_idx on public.cart_items(session_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_customer_email_idx on public.orders(customer_email);
create index if not exists order_items_order_id_idx on public.order_items(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_updated_at();

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_updated_at();

drop trigger if exists cart_items_set_updated_at on public.cart_items;
create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.sync_variant_inventory()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  insert into public.inventory (variant_id, quantity_on_hand)
  values (new.id, new.stock)
  on conflict (variant_id) do update
    set quantity_on_hand = excluded.quantity_on_hand,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists product_variants_sync_inventory on public.product_variants;
create trigger product_variants_sync_inventory
after insert or update of stock on public.product_variants
for each row execute function public.sync_variant_inventory();

insert into public.inventory (variant_id, quantity_on_hand)
select id, stock
from public.product_variants
on conflict (variant_id) do update
  set quantity_on_hand = excluded.quantity_on_hand,
      updated_at = now();

create or replace function public.is_backoffice()
returns boolean
language sql
stable
set search_path = public, auth, pg_catalog
as $$
  select
    current_user in ('app_server', 'service_role')
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'warehouse'), false);
$$;

alter table public.categories enable row level security;
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

alter table public.categories force row level security;
alter table public.users force row level security;
alter table public.products force row level security;
alter table public.product_variants force row level security;
alter table public.inventory force row level security;
alter table public.cart_items force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;

drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories"
on public.categories for select
to anon, authenticated
using (true);

drop policy if exists "Backoffice can manage categories" on public.categories;
create policy "Backoffice can manage categories"
on public.categories for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
to anon, authenticated
using (status = 'active');

drop policy if exists "Backoffice can manage products" on public.products;
create policy "Backoffice can manage products"
on public.products for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Public can read active product variants" on public.product_variants;
create policy "Public can read active product variants"
on public.product_variants for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_variants.product_id
      and products.status = 'active'
  )
);

drop policy if exists "Backoffice can manage product variants" on public.product_variants;
create policy "Backoffice can manage product variants"
on public.product_variants for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Public can read active inventory" on public.inventory;
create policy "Public can read active inventory"
on public.inventory for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_variants
    join public.products on products.id = product_variants.product_id
    where product_variants.id = inventory.variant_id
      and products.status = 'active'
  )
);

drop policy if exists "Backoffice can manage inventory" on public.inventory;
create policy "Backoffice can manage inventory"
on public.inventory for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Backoffice can manage carts" on public.cart_items;
create policy "Backoffice can manage carts"
on public.cart_items for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Backoffice can manage users" on public.users;
create policy "Backoffice can manage users"
on public.users for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Customers can read orders by email" on public.orders;
create policy "Customers can read orders by email"
on public.orders for select
to authenticated
using (customer_email = auth.jwt() ->> 'email');

drop policy if exists "Backoffice can manage orders" on public.orders;
create policy "Backoffice can manage orders"
on public.orders for all
using (public.is_backoffice())
with check (public.is_backoffice());

drop policy if exists "Customers can read their order items" on public.order_items;
create policy "Customers can read their order items"
on public.order_items for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.customer_email = auth.jwt() ->> 'email'
  )
);

drop policy if exists "Backoffice can manage order items" on public.order_items;
create policy "Backoffice can manage order items"
on public.order_items for all
using (public.is_backoffice())
with check (public.is_backoffice());

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_variants, public.inventory to anon, authenticated;
grant select on public.orders, public.order_items to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_server') then
    grant usage on schema public to app_server;
    grant select, insert, update, delete on all tables in schema public to app_server;
    grant usage, select on all sequences in schema public to app_server;
  end if;
end;
$$;

commit;
