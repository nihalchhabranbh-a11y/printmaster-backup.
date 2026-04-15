// Supabase Edge Function: send-bill-email
// Sends invoice/payment emails via an HTTPS email API (Resend).
//
// Why: Edge Functions often cannot send outbound SMTP on ports like 587 reliably.
//
// Required secrets (set in Supabase):
// - RESEND_API_KEY
// - FROM_EMAIL   (must be a verified sender in Resend)
// - FROM_NAME
//
// Deploy:
// supabase functions deploy send-bill-email
//
// Set secrets:
// supabase secrets set SMTP_HOST=smtp.titan.email SMTP_PORT=587 SMTP_USER=org@shiromani.xyz SMTP_PASS=... FROM_EMAIL=org@shiromani.xyz FROM_NAME="Shiromani"

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function fmtCur(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);
  } catch {
    return `₹${Number(n || 0).toFixed(2)}`;
  }
}

function escapeHtml(s: string) {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const {
      type,
      bill,
      brand,
      to,
      cc,
      origin,
    } = await req.json();

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    const fromEmail = Deno.env.get("FROM_EMAIL") || "";
    const fromName = Deno.env.get("FROM_NAME") || "PrintMaster";

    if (!resendKey || !fromEmail) {
      return new Response(JSON.stringify({ ok: false, error: "Email secrets not configured (RESEND_API_KEY / FROM_EMAIL)" }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const b = bill || {};
    const br = brand || {};
    const shop = br.shopName || "PrintMaster";
    const invId = b.id || "";
    const total = Number(b.total || 0);
    const customer = b.customer || "Customer";
    const invLink = `${origin || ""}?inv=${encodeURIComponent(invId)}`;
    const payLink = `${origin || ""}?pay=${encodeURIComponent(invId)}`;

    const subj =
      type === "payment_received"
        ? `Payment received — ${shop} — ${invId}`
        : `Invoice from ${shop} — ${invId}`;

    const headline =
      type === "payment_received"
        ? "Payment received"
        : "Invoice created";

    const statusLine =
      type === "payment_received"
        ? `Status: PAID`
        : (b.paid ? "Status: PAID" : "Status: PAYMENT PENDING");

    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;line-height:1.45;color:#0f172a">
        <div style="max-width:640px;margin:0 auto;padding:18px">
          <div style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#312e81,#6366f1);padding:18px 20px;color:white">
              <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.9">${escapeHtml(shop)}</div>
              <div style="font-size:20px;font-weight:800;margin-top:6px">${escapeHtml(headline)}</div>
            </div>
            <div style="padding:18px 20px;background:#ffffff">
              <div style="font-size:14px;margin-bottom:14px">Hi ${escapeHtml(customer)},</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">
                <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px">
                  <div style="font-size:12px;color:#64748b">Invoice No</div>
                  <div style="font-weight:800">${escapeHtml(invId)}</div>
                </div>
                <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px">
                  <div style="font-size:12px;color:#64748b">Total</div>
                  <div style="font-weight:900;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${escapeHtml(fmtCur(total))}</div>
                </div>
              </div>
              <div style="padding:12px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:14px">
                <div style="font-size:12px;color:#64748b">Work / Description</div>
                <div style="font-weight:700">${escapeHtml(b.desc || b.description || "—")}</div>
                <div style="font-size:12px;color:#64748b;margin-top:6px">${escapeHtml(statusLine)}</div>
              </div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
                <a href="${escapeHtml(invLink)}" style="background:#4f67ff;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:800;display:inline-block">View invoice</a>
                <a href="${escapeHtml(payLink)}" style="background:#0ea5e9;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:800;display:inline-block">Pay now (QR)</a>
              </div>
              <div style="margin-top:18px;font-size:12px;color:#64748b">
                Thank you,<br/>
                <b>${escapeHtml(shop)}</b>${br.phone ? `<br/>Phone: ${escapeHtml(br.phone)}` : ""}${br.address ? `<br/>${escapeHtml(br.address)}` : ""}
              </div>
            </div>
          </div>
          <div style="font-size:11px;color:#94a3b8;margin-top:10px;text-align:center">Sent by PrintMaster</div>
        </div>
      </div>
    `.trim();

    const recipients: string[] = [];
    if (to) recipients.push(String(to));
    if (cc && !recipients.includes(String(cc))) recipients.push(String(cc));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No recipients" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: to ? [String(to)] : [],
        cc: cc ? [String(cc)] : [],
        subject: subj,
        html,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ ok: false, error: `Resend error (${res.status})`, details: t }), {
        status: 502,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
});

