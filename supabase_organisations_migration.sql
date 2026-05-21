-- PrintMaster Pro — Multi-tenant organisations migration
-- Run this in Supabase SQL Editor.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS).

-- 1. ORGANISATIONS
create table if not exists organisations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  shop_name text,
  slug text unique,
  logo text,
  address text,
  phone text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  access_enabled boolean default true,
  locked_reason text,
  created_at timestamptz default now()
);

-- If table already existed before, ensure new columns exist
alter table organisations add column if not exists access_enabled boolean default true;
alter table organisations add column if not exists locked_reason text;

-- 2. ORG ADMINS (registrant becomes org admin after approval)
create table if not exists org_admins (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid references organisations(id) on delete cascade not null,
  username text not null,
  password text not null,
  name text,
  email text,
  created_at timestamptz default now(),
  unique(organisation_id, username)
);

-- 3. Add organisation_id to tenant tables (nullable for backward compatibility)
alter table bills add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table tasks add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table customers add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table workers add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table vendors add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table vendor_bills add column if not exists organisation_id uuid references organisations(id) on delete cascade;
alter table purchases add column if not exists organisation_id uuid references organisations(id) on delete cascade;

-- Settings: app may use id-based or key-based. Add organisation_id if settings has id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'id'
  ) then
    alter table settings add column if not exists organisation_id uuid references organisations(id) on delete cascade;
  end if;
  -- If settings uses key (fix_tables.sql style), create org-scoped settings table
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'key'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'settings' and column_name = 'organisation_id'
  ) then
    alter table settings add column if not exists organisation_id uuid references organisations(id) on delete cascade;
  end if;
end $$;

-- 4. Indexes for fast filtering
create index if not exists idx_bills_organisation_id on bills(organisation_id);
create index if not exists idx_tasks_organisation_id on tasks(organisation_id);
create index if not exists idx_customers_organisation_id on customers(organisation_id);
create index if not exists idx_workers_organisation_id on workers(organisation_id);
create index if not exists idx_vendors_organisation_id on vendors(organisation_id);
create index if not exists idx_vendor_bills_organisation_id on vendor_bills(organisation_id);
create index if not exists idx_purchases_organisation_id on purchases(organisation_id);
create index if not exists idx_org_admins_organisation_id on org_admins(organisation_id);

-- 5. Create Default org and backfill existing data (one-time)
do $$
declare
  default_org_id uuid;
begin
  -- Only run if we have rows without organisation_id
  if exists (select 1 from bills limit 1) and not exists (select 1 from bills where organisation_id is not null limit 1)
     or exists (select 1 from tasks limit 1) and not exists (select 1 from tasks where organisation_id is not null limit 1)
     or exists (select 1 from workers limit 1) and not exists (select 1 from workers where organisation_id is not null limit 1)
  then
    insert into organisations (name, shop_name, slug, status)
    values ('Default', 'Default Shop', 'default', 'approved')
    on conflict (slug) do nothing;

    select id into default_org_id from organisations where slug = 'default' limit 1;

    if default_org_id is not null then
      update bills set organisation_id = default_org_id where organisation_id is null;
      update tasks set organisation_id = default_org_id where organisation_id is null;
      update customers set organisation_id = default_org_id where organisation_id is null;
      update workers set organisation_id = default_org_id where organisation_id is null;
      update vendors set organisation_id = default_org_id where organisation_id is null;
      update vendor_bills set organisation_id = default_org_id where organisation_id is null;
      update purchases set organisation_id = default_org_id where organisation_id is null;
      update settings set organisation_id = default_org_id where organisation_id is null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settings' and column_name = 'organisation_id');
    end if;
  end if;
end $$;

-- 6. Disable RLS
alter table organisations disable row level security;
alter table org_admins disable row level security;
