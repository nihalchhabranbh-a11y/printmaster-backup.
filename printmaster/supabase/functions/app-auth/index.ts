import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyPassword(plaintext: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  // Backward-compat: plaintext not yet migrated
  if (!stored.startsWith("pbkdf2:")) return plaintext === stored;
  const parts = stored.split(":");
  if (parts.length !== 5) return false;
  const [, , iterStr, saltHex, expectedHex] = parts;
  const iterations = parseInt(iterStr, 10);
  if (!iterations) return false;
  const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey("raw", new TextEncoder().encode(plaintext), "PBKDF2", false, ["deriveBits"]);
  } catch { return false; }
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, hash: "SHA-256", iterations }, key, 256);
  const computedHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computedHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { username, password } = await req.json();
    const u = (username ?? "").trim();
    const p = (password ?? "").trim();
    if (!u || !p) return json({ user: null, error: "Missing credentials" }, 400);

    // 1. Super-admin via env vars
    const adminUser = Deno.env.get("ADMIN_USERNAME") ?? "";
    const adminPass = Deno.env.get("ADMIN_PASSWORD") ?? "";
    if (adminUser && adminPass && u === adminUser && p === adminPass) {
      return json({ user: { id: "super-admin", username: u, role: "admin", name: u, organisationId: null } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Helper: fetch org status — select only columns that actually exist
    const fetchOrg = async (orgId: string | null) => {
      if (!orgId) return null;
      const { data, error } = await admin
        .from("organisations")
        .select("status, access_enabled")
        .eq("id", orgId)
        .maybeSingle();
      if (error) console.error("fetchOrg error:", error.message);
      return data ?? null;
    };
    const orgOk = (org: any) => org && org.status === "approved" && org.access_enabled !== false;

    // 2. Org admins
    const { data: adminRow, error: adminErr } = await admin
      .from("org_admins")
      .select("id, username, password, name, organisation_id")
      .eq("username", u).limit(1).maybeSingle();
    if (adminErr) console.error("org_admins query error:", adminErr.message);
    if (adminRow && (await verifyPassword(p, adminRow.password))) {
      const org = await fetchOrg(adminRow.organisation_id);
      if (orgOk(org)) {
        return json({ user: { id: adminRow.id, username: adminRow.username, role: "admin", name: adminRow.name || adminRow.username, organisationId: adminRow.organisation_id } });
      }
    }

    // 3. Workers
    const { data: workerRow, error: workerErr } = await admin
      .from("workers")
      .select("id, username, password, name, role, organisation_id")
      .eq("username", u).limit(1).maybeSingle();
    if (workerErr) console.error("workers query error:", workerErr.message);
    if (workerRow && (await verifyPassword(p, workerRow.password))) {
      const org = await fetchOrg(workerRow.organisation_id);
      if (orgOk(org)) {
        return json({ user: { id: workerRow.id, username: workerRow.username, role: workerRow.role || "worker", name: workerRow.name || workerRow.username, organisationId: workerRow.organisation_id } });
      }
    }

    // 4. Vendors
    const { data: vendorRow, error: vendorErr } = await admin
      .from("vendors")
      .select("id, username, password, name, firm_name, organisation_id")
      .eq("username", u).limit(1).maybeSingle();
    if (vendorErr) console.error("vendors query error:", vendorErr.message);
    if (vendorRow && (await verifyPassword(p, vendorRow.password))) {
      const org = await fetchOrg(vendorRow.organisation_id);
      if (orgOk(org)) {
        return json({ user: { id: vendorRow.id, username: vendorRow.username, role: "vendor", name: vendorRow.name || vendorRow.firm_name || vendorRow.username, organisationId: vendorRow.organisation_id } });
      }
    }

    return json({ user: null });
  } catch (err) {
    console.error("app-auth error:", err);
    return json({ user: null, error: String(err) }, 500);
  }
});
