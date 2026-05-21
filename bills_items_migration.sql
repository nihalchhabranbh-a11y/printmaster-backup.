-- Add multi-item support to bills (run in Supabase SQL editor if you use multi-item line rows)
-- Existing bills without this column will still work (single line from description/qty/rate).
ALTER TABLE bills ADD COLUMN IF NOT EXISTS items jsonb DEFAULT NULL;
