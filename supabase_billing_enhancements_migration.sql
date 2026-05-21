-- PrintMaster Pro — Billing & Products enhancements
-- Run this in Supabase SQL Editor after running the base migrations.
-- Safe to run multiple times (uses IF NOT EXISTS / additive ALTERs only).

-- 1. PRODUCTS / SERVICES MASTER
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  organisation_id uuid references public.organisations(id) on delete cascade,
  name text not null,
  category text default 'product', -- e.g. 'product' or 'service'
  unit text,                       -- e.g. 'pcs', 'sqft', 'hour'
  default_rate numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_products_organisation_id on products(organisation_id);
create index if not exists idx_products_active on products(active);

alter table public.products disable row level security;


-- 2. CUSTOMER BILL PAYMENTS (supports partial + method-wise totals)
create table if not exists bill_payments (
  id uuid default gen_random_uuid() primary key,
  bill_id text references public.bills(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  method text default 'cash', -- 'cash' | 'upi' | 'bank' | 'card' | 'other'
  amount numeric not null default 0,
  note text,
  paid_at timestamptz default now()
);

create index if not exists idx_bill_payments_bill_id on bill_payments(bill_id);
create index if not exists idx_bill_payments_org on bill_payments(organisation_id);
create index if not exists idx_bill_payments_paid_at on bill_payments(paid_at);

alter table public.bill_payments disable row level security;


-- 3. VENDOR PAYMENTS (what we pay to vendors)
create table if not exists vendor_payments (
  id uuid default gen_random_uuid() primary key,
  vendor_bill_id text references public.vendor_bills(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  method text default 'cash',
  amount numeric not null default 0,
  note text,
  paid_at timestamptz default now()
);

create index if not exists idx_vendor_payments_bill_id on vendor_payments(vendor_bill_id);
create index if not exists idx_vendor_payments_org on vendor_payments(organisation_id);
create index if not exists idx_vendor_payments_paid_at on vendor_payments(paid_at);

alter table public.vendor_payments disable row level security;


-- 4. EXTRA FIELDS ON BILLS (due date + notes)
alter table public.bills
  add column if not exists due_date date,
  add column if not exists notes text;

-- Optional: due date on vendor_bills (used for what we owe vendors)
alter table public.vendor_bills
  add column if not exists due_date date;

