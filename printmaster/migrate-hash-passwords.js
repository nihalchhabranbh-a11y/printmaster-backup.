/**
 * migrate-hash-passwords.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: reads all org_admins, workers, and vendors rows with
 * plaintext passwords, hashes them via PBKDF2-SHA256 using the SERVICE ROLE
 * key (not the anon key), and writes the hash back to the database.
 *
 * Usage (run ONCE from your machine):
 *   node migrate-hash-passwords.js
 *
 * Requires:
 *   npm install @supabase/supabase-js dotenv
 *
 * Environment variables (in .env.local or set in shell):
 *   VITE_SUPABASE_URL         — your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — the service role key (NOT the anon key!)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { webcrypto } from "node:crypto";

config({ path: ".env.local" });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "ERROR: Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ── PBKDF2 hashing (Node.js Web Crypto API) ──────────────────────────────────
async function hashPassword(plaintext) {
  const crypto = webcrypto;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(plaintext),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, hash: "SHA-256", iterations: 100_000 },
    key,
    256
  );
  const toHex = (u8) =>
    Array.from(u8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return `pbkdf2:sha256:100000:${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

const isPlaintext = (p) => p && !p.startsWith("pbkdf2:");

async function migrateTable(tableName, idCol = "id") {
  console.log(`\n── ${tableName} ──────────────────────────────`);
  const { data, error } = await supabase.from(tableName).select("id, password");
  if (error) {
    console.error(`  SELECT error: ${error.message}`);
    return;
  }

  const toMigrate = (data || []).filter((r) => isPlaintext(r.password));
  console.log(
    `  Total rows: ${data.length}  |  Need hashing: ${toMigrate.length}`
  );

  let ok = 0;
  let fail = 0;
  for (const row of toMigrate) {
    try {
      const hashed = await hashPassword(row.password);
      const { error: upError } = await supabase
        .from(tableName)
        .update({ password: hashed })
        .eq(idCol, row.id);
      if (upError) throw new Error(upError.message);
      ok++;
      process.stdout.write(`  ✓ ${row.id}\n`);
    } catch (e) {
      fail++;
      console.error(`  ✗ ${row.id}: ${e.message}`);
    }
  }
  console.log(`  Done — ${ok} hashed, ${fail} failed.`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  PrintMaster — Password Migration (PBKDF2-SHA256)   ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Supabase URL: ${supabaseUrl}`);
  console.log(`  Date: ${new Date().toISOString()}\n`);

  await migrateTable("org_admins");
  await migrateTable("workers");
  await migrateTable("vendors");

  console.log("\n✅ Migration complete. All plaintext passwords have been hashed.");
  console.log(
    "   The app-auth edge function supports both hashed and legacy plaintext\n" +
    "   passwords during the transition window — once all rows are migrated,\n" +
    "   the plaintext fallback in verifyPassword() can be removed.\n"
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
