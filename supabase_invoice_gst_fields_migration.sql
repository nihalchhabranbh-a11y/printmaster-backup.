-- PrintMaster Pro - GST invoice and bill-of-supply fields
-- Run this in Supabase SQL Editor after the base billing migrations.
-- Safe to run multiple times.

alter table public.settings
  add column if not exists state text,
  add column if not exists gst_number text,
  add column if not exists pan_number text,
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists account_number text,
  add column if not exists ifsc_code text,
  add column if not exists branch_name text,
  add column if not exists authorised_signatory text;

alter table public.bills
  add column if not exists po_number text,
  add column if not exists customer_address text,
  add column if not exists customer_gstin text,
  add column if not exists ship_to_name text,
  add column if not exists ship_to_address text,
  add column if not exists place_of_supply text,
  add column if not exists invoice_type text default 'supply';

update public.bills
set invoice_type = case when coalesce(gst, false) then 'tax' else 'supply' end
where invoice_type is null;
