-- Item-specific tax rate field
-- Safe to run multiple times

alter table public.products
  add column if not exists tax_rate numeric default 0;
