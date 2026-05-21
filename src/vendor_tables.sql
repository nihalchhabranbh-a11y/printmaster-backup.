-- PrintMaster Pro — Vendor module
-- Run this in Supabase SQL Editor after fix_tables.sql

-- 1. VENDORS (external vendors with login)
create table if not exists vendors (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  firm_name text,
  username text unique not null,
  password text not null,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- 2. VENDOR BILLS (bills created by vendors TO our company - what we owe them)
create table if not exists vendor_bills (
  id text primary key,
  vendor_id uuid references vendors(id) on delete cascade,
  description text,
  amount numeric default 0,
  paid boolean default false,
  created_at timestamptz default now()
);

-- 3. Add vendor_id to tasks (optional - assign task to worker OR vendor)
alter table tasks add column if not exists vendor_id uuid references vendors(id) on delete set null;

-- Disable RLS
alter table vendors disable row level security;
alter table vendor_bills disable row level security;
