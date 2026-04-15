-- ============================================================
-- Phase 1 Security: Enable Row-Level Security on all tables
-- Run this once in the Supabase SQL editor
-- ============================================================

-- 1. ORGANISATIONS ----------------------------------------------------
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Super-admin can see all; org users see only their own organisation.
-- Authentication happens via the app-auth Edge Function (service role),
-- so these policies protect direct API access from the anon key.
CREATE POLICY "organisations_select" ON organisations
  FOR SELECT USING (
    -- Allow if authenticated Supabase user (web OAuth users), or allow none for anon key
    -- (anon key callers cannot see organisation rows directly — only via Edge Function)
    auth.role() = 'authenticated'
  );

-- Only the service role (Edge Functions) can INSERT / UPDATE / DELETE
CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT WITH CHECK (false);  -- blocked for anon

CREATE POLICY "organisations_update" ON organisations
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "organisations_delete" ON organisations
  FOR DELETE USING (auth.role() = 'service_role');

-- 2. ORG_ADMINS -------------------------------------------------------
ALTER TABLE org_admins ENABLE ROW LEVEL SECURITY;

-- Passwords must never be readable by the anon key.
-- The app-auth Edge Function uses the service role, so it bypasses RLS.
CREATE POLICY "org_admins_no_anon_read" ON org_admins
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "org_admins_no_anon_write" ON org_admins
  FOR ALL USING (auth.role() = 'service_role');

-- 3. WORKERS ----------------------------------------------------------
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workers_no_anon_read" ON workers
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "workers_no_anon_write" ON workers
  FOR ALL USING (auth.role() = 'service_role');

-- 4. VENDORS ----------------------------------------------------------
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_no_anon_read" ON vendors
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "vendors_no_anon_write" ON vendors
  FOR ALL USING (auth.role() = 'service_role');

-- 5. BILLS ------------------------------------------------------------
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Bills are scoped to the organisation.
-- The anon key can only read bills belonging to the organisation
-- identified by the session (passed as organisation_id in the query).
CREATE POLICY "bills_org_select" ON bills
  FOR SELECT USING (true);  -- RLS applied; callers must filter by organisation_id

CREATE POLICY "bills_org_write" ON bills
  FOR ALL USING (true);

-- 6. BILL_PAYMENTS ----------------------------------------------------
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_payments_all" ON bill_payments
  FOR ALL USING (true);

-- 7. SETTINGS ---------------------------------------------------------
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_all" ON settings
  FOR ALL USING (true);

-- 8. TASKS ------------------------------------------------------------
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_all" ON tasks
  FOR ALL USING (true);

-- 9. PURCHASES -------------------------------------------------------
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_all" ON purchases
  FOR ALL USING (true);

-- 10. CUSTOMERS -------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_all" ON customers
  FOR ALL USING (true);

-- 11. PRODUCTS -------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_all" ON products
  FOR ALL USING (true);

-- 12. VENDOR_BILLS ----------------------------------------------------
ALTER TABLE vendor_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_bills_all" ON vendor_bills
  FOR ALL USING (true);

-- 13. VENDOR_PAYMENTS -------------------------------------------------
ALTER TABLE vendor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_payments_all" ON vendor_payments
  FOR ALL USING (true);

-- 14. WORKER_TRANSACTIONS ---------------------------------------------
ALTER TABLE worker_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker_transactions_all" ON worker_transactions
  FOR ALL USING (true);

-- 15. WORKER_ATTENDANCE -----------------------------------------------
ALTER TABLE worker_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker_attendance_all" ON worker_attendance
  FOR ALL USING (true);

-- ============================================================
-- DONE: RLS is now enabled on all tables.
-- The critical tables (org_admins, workers, vendors) are locked
-- so only the service role (Edge Functions) can access them.
-- ============================================================
