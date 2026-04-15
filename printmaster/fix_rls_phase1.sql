-- Fix for invisible Staff and Vendors created in Phase 1 Security
-- The previous RLS policies locked the workers and vendors table so only Edge Functions could read/write them.
-- This prevented the frontend (which uses the anon key) from seeing or managing Staff and Vendors.
-- This script reverts those specific read/write restrictions back to allowing the frontend client to perform CRUD.

DROP POLICY IF EXISTS "org_admins_no_anon_read" ON org_admins;
DROP POLICY IF EXISTS "org_admins_no_anon_write" ON org_admins;
DROP POLICY IF EXISTS "workers_no_anon_read" ON workers;
DROP POLICY IF EXISTS "workers_no_anon_write" ON workers;
DROP POLICY IF EXISTS "vendors_no_anon_read" ON vendors;
DROP POLICY IF EXISTS "vendors_no_anon_write" ON vendors;

-- Allow org_admins CRUD operations from the client
CREATE POLICY "org_admins_all" ON org_admins FOR ALL USING (true);

-- Allow workers CRUD operations from the client
CREATE POLICY "workers_all" ON workers FOR ALL USING (true);

-- Allow vendors CRUD operations from the client
CREATE POLICY "vendors_all" ON vendors FOR ALL USING (true);
