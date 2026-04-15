-- PrintMaster Pro — Run this in Supabase SQL Editor
-- This creates/fixes all tables to work with the app

-- Drop old tables if they exist (start fresh)
drop table if exists payments cascade;
drop table if exists notifications cascade;
drop table if exists tasks cascade;
drop table if exists bills cascade;
drop table if exists customers cascade;
drop table if exists settings cascade;
drop table if exists users cascade;

-- 1. USERS (admin + workers)
create table users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  username text unique not null,
  password text not null,
  role text default 'worker' check (role in ('admin', 'worker')),
  created_at timestamptz default now()
);

-- 2. BILLS
create table bills (
  id text primary key,
  customer text,
  phone text,
  email text,
  description text,
  size text,
  qty integer default 1,
  rate numeric default 0,
  subtotal numeric default 0,
  gst_amt numeric default 0,
  total numeric default 0,
  gst boolean default false,
  paid boolean default false,
  created_at timestamptz default now()
);

-- 3. TASKS
create table tasks (
  id text primary key,
  title text,
  customer text,
  worker text,
  deadline text,
  notes text,
  status text default 'Pending',
  created_at timestamptz default now()
);

-- 4. CUSTOMERS
create table customers (
  id text primary key,
  name text,
  phone text unique,
  email text,
  created_at timestamptz default now()
);

-- 5. SETTINGS (shop info, invoice counter)
create table settings (
  key text primary key,
  value jsonb
);

-- 6. NOTIFICATIONS
create table notifications (
  id uuid default gen_random_uuid() primary key,
  message text,
  read boolean default false,
  created_at timestamptz default now()
);

-- 7. PAYMENTS log
create table payments (
  id uuid default gen_random_uuid() primary key,
  bill_id text references bills(id) on delete cascade,
  amount numeric,
  method text default 'cash',
  note text,
  paid_at timestamptz default now()
);

-- Default admin user
insert into users (name, username, password, role)
values ('Admin', 'admin', 'admin123', 'admin');

-- Default settings
insert into settings (key, value) values
  ('brand', '{"shopName":"PrintMaster Pro","invoicePrefix":"NPW","invoiceCounter":1,"address":"123, Main Market, New Delhi - 110001","phone":"+91-98765-43210","whatsapp":"919876543210","gmail":"printmaster@gmail.com"}');

-- DISABLE RLS on all tables (IMPORTANT!)
alter table users disable row level security;
alter table bills disable row level security;
alter table tasks disable row level security;
alter table customers disable row level security;
alter table settings disable row level security;
alter table notifications disable row level security;
alter table payments disable row level security;
