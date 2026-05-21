-- PrintMaster Pro — Products table only (minimal, no FK dependencies)
-- Run this in Supabase SQL Editor if the full migration fails.
-- Safe to run multiple times.

create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid,
  name text not null,
  category text default 'product',
  unit text,
  default_rate numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_products_organisation_id on products(organisation_id);
create index if not exists idx_products_active on products(active);

alter table public.products disable row level security;
