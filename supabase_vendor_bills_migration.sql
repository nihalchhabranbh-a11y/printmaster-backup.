-- Supabase migration: make vendor_bills compatible with PrintMaster Pro app
-- Safe to run multiple times.
--
-- Goal:
-- - Ensure vendor_bills has: id (or bill_number), vendor_id, description, amount, paid, created_at
-- - Keep existing data; never delete.
-- - Works even if your current table has bill_number + due_date.

do $$
begin
  -- If table has bill_number but not id, rename bill_number -> id (so app works cleanly).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vendor_bills'
      and column_name = 'bill_number'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vendor_bills'
      and column_name = 'id'
  ) then
    alter table public.vendor_bills rename column bill_number to id;
  end if;
exception
  when undefined_table then
    -- If vendor_bills doesn't exist yet, create it in the expected shape.
    create table public.vendor_bills (
      id text primary key,
      vendor_id uuid references public.vendors(id) on delete cascade,
      description text,
      amount numeric default 0,
      paid boolean default false,
      created_at timestamptz default now()
    );
end $$;

-- Add missing columns (non-destructive)
alter table public.vendor_bills add column if not exists vendor_id uuid;
alter table public.vendor_bills add column if not exists description text;
alter table public.vendor_bills add column if not exists amount numeric default 0;
alter table public.vendor_bills add column if not exists paid boolean default false;
alter table public.vendor_bills add column if not exists created_at timestamptz default now();

-- Disable RLS (matches how the rest of this app is configured)
alter table public.vendor_bills disable row level security;

