-- Replace the password before running this in the Supabase SQL editor.
-- The API should use this role in DATABASE_URL so Row-Level Security is enforced.

create role app_server
  login
  password 'replace_with_a_long_random_password'
  noinherit
  nobypassrls;

grant usage on schema public to app_server;
grant select, insert, update, delete on all tables in schema public to app_server;
grant usage, select on all sequences in schema public to app_server;

alter default privileges in schema public
grant select, insert, update, delete on tables to app_server;

alter default privileges in schema public
grant usage, select on sequences to app_server;
