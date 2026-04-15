-- New party and item fields for richer customer/product setup
-- Safe to run multiple times

alter table public.customers
  add column if not exists gstin text,
  add column if not exists pan_number text,
  add column if not exists billing_address text,
  add column if not exists shipping_address text,
  add column if not exists state text,
  add column if not exists opening_balance numeric default 0,
  add column if not exists balance_type text default 'to_collect',
  add column if not exists credit_period_days integer default 0,
  add column if not exists credit_limit numeric default 0,
  add column if not exists contact_person_name text,
  add column if not exists date_of_birth date,
  add column if not exists party_type text default 'customer',
  add column if not exists party_category text;

alter table public.products
  add column if not exists item_code text,
  add column if not exists hsn_code text,
  add column if not exists purchase_price numeric default 0,
  add column if not exists opening_stock numeric default 0,
  add column if not exists stock_as_of date,
  add column if not exists size text,
  add column if not exists description text;
