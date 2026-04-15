-- ═══════════════════════════════════════════════════════════════
--  PrintMaster – SUBSCRIPTIONS UPDATE
--  Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Add `plan` column to organisations (default 'free')
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- Update all existing NULL plans to 'free' just in case
UPDATE organisations SET plan = 'free' WHERE plan IS NULL;

-- If you want to manually upgrade your own test organisation to GST plan, run this:
-- UPDATE organisations SET plan = '499' WHERE name = 'Your Org Name';
