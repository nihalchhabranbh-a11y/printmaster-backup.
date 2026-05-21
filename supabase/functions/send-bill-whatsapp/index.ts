// Supabase Edge Function: send-bill-whatsapp
// Sends invoice/payment WhatsApp template messages via Infobip.
//
// Required secrets (set in Supabase):
// - INFOBIP_API_KEY       (App key from Infobip dashboard)
// - INFOBIP_BASE_URL      (e.g. m9385w.api.infobip.com, WITHOUT https://)
// - INFOBIP_WA_FROM       (WhatsApp sender number, e.g. 447860088970)
//
// Endpoint we call:
//   POST https://{INFOBIP_BASE_URL}/whatsapp/1/message/template

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

type SendBillWhatsAppPayload = {
  type: "invoice_created" | "payment_received";
  bill: any;
  brand?: any;
  to: string | null;
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as SendBillWhatsAppPayload;
    const { type, bill, brand, to } = body || {};

    if (!to) {
      return new Response(JSON.stringify({ ok: false, error: "Missing recipient phone (to)" }), {
        status: 400,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const apiKey = Deno.env.get("INFOBIP_API_KEY") || "";
    const baseUrl = (Deno.env.get("INFOBIP_BASE_URL") || "").trim();
    const from = (Deno.env.get("INFOBIP_WA_FROM") || "").trim();

    if (!apiKey || !baseUrl || !from) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "WhatsApp secrets not configured (INFOBIP_API_KEY / INFOBIP_BASE_URL / INFOBIP_WA_FROM)",
        }),
        {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders },
        },
      );
    }

    const b = bill || {};
    const br = brand || {};

    const customerName = b.customer || b.customer_name || "Customer";
    const invoiceNumber = b.id || b.invoice_no || "";
    const totalAmount = String(b.total ?? b.grand_total ?? b.subtotal ?? "");
    const dueDate = b.due_date || b.dueDate || "";

    // For now we always use the same approved template name in Infobip:
    const templateName = "appointment_reminder";

    const url = `https://${baseUrl.replace(/^https?:\/\//, "")}/whatsapp/1/message/template`;

    const waBody = {
      messages: [
        {
          from,
          to,
          content: {
            templateName,
            templateData: {
              body: {
                // appointment_reminder body placeholders:
                // {{1}} = customer name
                // {{2}} = invoice number
                // {{3}} = total amount
                // {{4}} = due date or payment note
                placeholders: [
                  String(customerName),
                  String(invoiceNumber),
                  String(totalAmount),
                  String(dueDate || (type === "payment_received" ? "Payment received" : "Payment pending")),
                ],
              },
            },
            language: "en",
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "authorization": `App ${apiKey}`,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(waBody),
    });

    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Infobip error (${res.status})`,
          details: text,
        }),
        {
          status: 502,
          headers: { "content-type": "application/json", ...corsHeaders },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        response: text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e?.message || String(e),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      },
    );
  }
});

