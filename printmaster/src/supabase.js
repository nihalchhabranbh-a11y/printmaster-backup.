import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Password hashing helper (calls server-side Edge Function) ─────────────────
// Passwords are NEVER hashed in the browser — the raw value is sent over TLS
// to the Edge Function which returns the PBKDF2-SHA256 hash.
export async function hashPasswordForStorage(plaintext) {
  const { data, error } = await supabase.functions.invoke("hash-password", {
    body: { password: String(plaintext) },
  });
  if (error || !data?.hash) {
    const msg = error?.message || "hash-password function returned no hash";
    console.error("hashPasswordForStorage:", msg);
    throw new Error("Failed to hash password: " + msg);
  }
  return data.hash;
}

export async function sendBillEmail({ type, bill, brand, to, cc }) {
  // type: "invoice_created" | "payment_received"
  // This uses a Supabase Edge Function (keeps SMTP password out of frontend).
  try {
    const { data, error } = await supabase.functions.invoke("send-bill-email", {
      body: {
        type,
        bill,
        brand,
        to,
        cc,
        origin: typeof window !== "undefined" ? window.location.origin : null,
      },
    });
    if (error) {
      console.error("sendBillEmail invoke error:", error.message || error);
      return { ok: false, error: error.message || String(error) };
    }
    return { ok: true, data };
  } catch (e) {
    console.error("sendBillEmail error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function sendBillWhatsApp({ type, bill, brand, to }) {
  // type: "invoice_created" | "payment_received"
  // This uses a Supabase Edge Function that talks to Infobip.
  try {
    const { data, error } = await supabase.functions.invoke("send-bill-whatsapp", {
      body: {
        type,
        bill,
        brand,
        to,
      },
    });
    if (error) {
      console.error("sendBillWhatsApp invoke error:", error.message || error);
      return { ok: false, error: error.message || String(error) };
    }
    return { ok: true, data };
  } catch (e) {
    console.error("sendBillWhatsApp error:", e?.message || e);
    return { ok: false, error: e?.message || String(e) };
  }
}

// ── Database helpers ─────────────────────────────────────────────
function normalizeVendorBill(row) {
  if (!row) return null;
  const id = row.id ?? row.bill_number ?? row.billNumber ?? null;
  const vendorId = row.vendor_id ?? row.vendorId ?? null;
  const createdAt = row.created_at ?? row.createdAt ?? null;
  const paid = row.paid ?? row.is_paid ?? row.isPaid ?? false;
  const description = row.description ?? row.desc ?? null;
  return {
    ...row,
    id,
    vendor_id: vendorId,
    paid: !!paid,
    description,
    createdAt,
  };
}

export const db = {

  // ORGANISATIONS
  async getOrganisations(status) {
    let q = supabase.from("organisations").select("*").order("created_at", { ascending: false });
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      console.error("getOrganisations:", error.message);
      return [];
    }
    return (data || []).map(o => ({ ...o, createdAt: o.created_at }));
  },

  async getApprovedOrganisations() {
    // Only orgs that are approved and not locked for non-payment
    let q = supabase
      .from("organisations")
      .select("*")
      .eq("status", "approved")
      .eq("access_enabled", true)
      .order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) {
      console.error("getApprovedOrganisations:", error.message);
      return [];
    }
    return (data || []).map(o => ({ ...o, createdAt: o.created_at }));
  },

  async addOrganisation(org) {
    const slug = (org.slug || (org.name || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "org-" + Date.now()).slice(0, 64);
    const payload = {
      name: org.name,
      shop_name: org.shopName ?? org.shop_name ?? null,
      slug,
      logo: org.logo ?? null,
      address: org.address ?? null,
      phone: org.phone ?? null,
      status: "pending",
    };
    const { data, error } = await supabase.from("organisations").insert([payload]).select("*").single();
    if (error) {
      console.error("addOrganisation:", error.message);
      throw new Error(error.message);
    }
    return { ...data, createdAt: data.created_at };
  },

  async addOrgAdmin(organisationId, admin) {
    const hashedPassword = await hashPasswordForStorage(admin.password);
    const payload = {
      organisation_id: organisationId,
      username: admin.username,
      password: hashedPassword,
      name: admin.name ?? admin.username,
      email: admin.email ?? null,
    };
    const { data, error } = await supabase.from("org_admins").insert([payload]).select("id, username, name, email, organisation_id, created_at").single();
    if (error) {
      console.error("addOrgAdmin:", error.message);
      throw new Error(error.message);
    }
    return { ...data, createdAt: data.created_at };
  },

  async approveOrganisation(id) {
    const { error } = await supabase.from("organisations").update({ status: "approved" }).eq("id", id);
    if (error) console.error("approveOrganisation:", error.message);
  },

  async rejectOrganisation(id) {
    const { error } = await supabase.from("organisations").update({ status: "rejected" }).eq("id", id);
    if (error) console.error("rejectOrganisation:", error.message);
  },

  async lockOrganisation(id, reason = "Payment due") {
    const { error } = await supabase
      .from("organisations")
      .update({ access_enabled: false, locked_reason: reason || null })
      .eq("id", id);
    if (error) console.error("lockOrganisation:", error.message);
  },

  async unlockOrganisation(id) {
    const { error } = await supabase
      .from("organisations")
      .update({ access_enabled: true, locked_reason: null })
      .eq("id", id);
    if (error) console.error("unlockOrganisation:", error.message);
  },

  // LOGIN HELPERS — delegates to the app-auth Edge Function (server-side, no plaintext exposure)
  async loginWithCredentials(username, password) {
    const u = (username || "").trim();
    const p = (password || "").trim();
    if (!u || !p) return null;

    const { data, error } = await supabase.functions.invoke("app-auth", {
      body: { username: u, password: p },
    });

    if (error) {
      console.error("loginWithCredentials invoke error:", error.message || error);
      throw new Error(error.message || "Authentication service unavailable");
    }

    return data?.user ?? null;
  },

  async getOrgAdmins(organisationId) {
    const { data, error } = await supabase.from("org_admins").select("*").eq("organisation_id", organisationId);
    if (error) {
      console.error("getOrgAdmins:", error.message);
      return [];
    }
    return data || [];
  },

  async getPendingOrganisationsWithAdmins() {
    const orgs = await this.getOrganisations("pending");
    if (orgs.length === 0) return [];
    const ids = orgs.map(o => o.id);
    const { data: admins } = await supabase.from("org_admins").select("organisation_id, username").in("organisation_id", ids);
    const adminByOrg = {};
    (admins || []).forEach(a => { if (!adminByOrg[a.organisation_id]) adminByOrg[a.organisation_id] = a.username; });
    return orgs.map(o => ({ ...o, adminUsername: adminByOrg[o.id] || "—" }));
  },

  // BILLS
  async getBills(organisationId) {
    let q = supabase.from("bills").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getBills:", error.message);
      return [];
    }

    return data.map(b => ({
      ...b,
      invoiceType: b.invoice_type ?? (b.gst ? "tax" : "supply"),
      docType: b.doc_type ?? "Sales Invoice",
      poNumber: b.po_number ?? null,
      customerAddress: b.customer_address ?? null,
      customerGstin: b.customer_gstin ?? null,
      shipToName: b.ship_to_name ?? null,
      shipToAddress: b.ship_to_address ?? null,
      placeOfSupply: b.place_of_supply ?? null,
      dueDate: b.due_date,
      notes: b.notes,
      gstAmt: b.gst_amt,
      status: b.status || "final",
      createdAt: b.created_at,
      desc: b.description || b.desc,
      items: b.items != null ? (Array.isArray(b.items) ? b.items : (typeof b.items === "string" ? (() => { try { return JSON.parse(b.items); } catch (_) { return null; } })() : null)) : null,
    }));
  },

  async getBillById(id) {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("getBillById:", error.message);
      return null;
    }

    return {
      ...data,
      invoiceType: data.invoice_type ?? (data.gst ? "tax" : "supply"),
      docType: data.doc_type ?? "Sales Invoice",
      poNumber: data.po_number ?? null,
      customerAddress: data.customer_address ?? null,
      customerGstin: data.customer_gstin ?? null,
      shipToName: data.ship_to_name ?? null,
      shipToAddress: data.ship_to_address ?? null,
      placeOfSupply: data.place_of_supply ?? null,
      desc: data.description || data.desc,
      gstAmt: data.gst_amt,
      dueDate: data.due_date,
      notes: data.notes,
      status: data.status || "final",
      createdAt: data.created_at,
      items: data.items != null ? (Array.isArray(data.items) ? data.items : (typeof data.items === "string" ? (() => { try { return JSON.parse(data.items); } catch (_) { return null; } })() : null)) : null,
    };
  },

  async addBill(bill) {
    console.log("[Supabase] INSERT bill → starting", bill);
    const row = {
      id: bill.id,
      customer: bill.customer,
      phone: bill.phone,
      email: bill.email,
      po_number: bill.poNumber ?? null,
      customer_address: bill.customerAddress ?? null,
      customer_gstin: bill.customerGstin ?? null,
      ship_to_name: bill.shipToName ?? null,
      ship_to_address: bill.shipToAddress ?? null,
      place_of_supply: bill.placeOfSupply ?? null,
      invoice_type: bill.invoiceType ?? (bill.gst ? "tax" : "supply"),
      doc_type: bill.docType ?? bill.doc_type ?? "Sales Invoice",
      description: bill.desc,
      size: bill.size,
      qty: bill.qty,
      rate: bill.rate,
      subtotal: bill.subtotal,
      gst_amt: bill.gstAmt,
      total: bill.total,
      gst: bill.gst,
      paid: bill.paid,
    };
    if (bill.dateStr) row.created_at = bill.dateStr;
    if (bill.dueDate) row.due_date = bill.dueDate;
    if (bill.notes) row.notes = bill.notes;
    
    if (bill.discount !== undefined) row.discount = bill.discount;
    if (bill.additionalCharges !== undefined) row.additional_charges = bill.additionalCharges;
    if (bill.roundOff !== undefined) row.round_off = bill.roundOff;
    if (bill.terms !== undefined) row.terms = bill.terms;

    if (bill.organisationId) row.organisation_id = bill.organisationId;
    if (bill.status) row.status = bill.status;
    if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
      row.items = bill.items;
    }

    const { data, error } = await supabase
      .from("bills")
      .upsert([row])
      .select()
      .single();

    if (error) {
      console.error("addBill:", error.message);
      return null;
    }

    console.log("[Supabase] INSERT bill → ok", { id: data.id });

    return {
      ...data,
      invoiceType: data.invoice_type ?? (data.gst ? "tax" : "supply"),
      docType: data.doc_type ?? "Sales Invoice",
      customerAddress: data.customer_address ?? null,
      customerGstin: data.customer_gstin ?? null,
      shipToName: data.ship_to_name ?? null,
      shipToAddress: data.ship_to_address ?? null,
      placeOfSupply: data.place_of_supply ?? null,
      desc: data.description,
      gstAmt: data.gst_amt,
      
      discount: data.discount,
      additionalCharges: data.additional_charges,
      roundOff: data.round_off,
      terms: data.terms,

      status: data.status || "final",
      createdAt: data.created_at,
      items: data.items != null ? (Array.isArray(data.items) ? data.items : (typeof data.items === "string" ? (() => { try { return JSON.parse(data.items); } catch (_) { return null; } })() : null)) : null,
    };
  },

  async updateBillPaid(id, paid) {
    console.log("[Supabase] UPDATE bill.paid → starting", { id, paid });
    const { error } = await supabase
      .from("bills")
      .update({ paid })
      .eq("id", id);

    if (error) {
      console.error("updateBillPaid:", error.message);
    } else {
      console.log("[Supabase] UPDATE bill.paid → ok", { id, paid });
    }
  },

  async deleteBill(id) {
    console.log("[Supabase] DELETE bill → starting", { id });
    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteBill:", error.message);
    } else {
      console.log("[Supabase] DELETE bill → ok", { id });
    }
  },

  // BILL PAYMENTS (per-payment records for partial payments & method tracking)
  async getBillPayments(organisationId) {
    let q = supabase.from("bill_payments").select("*").order("paid_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;
    if (error) {
      console.error("getBillPayments:", error.message);
      return [];
    }
    return (data || []).map(p => ({
      ...p,
      billId: p.bill_id,
      method: p.method || "cash",
      amount: Number(p.amount) || 0,
      note: p.note,
      paidAt: p.paid_at,
    }));
  },

  async getPaymentsForBill(billId) {
    const { data, error } = await supabase
      .from("bill_payments")
      .select("*")
      .eq("bill_id", billId)
      .order("paid_at", { ascending: true });
    if (error) {
      console.error("getPaymentsForBill:", error.message);
      return [];
    }
    return (data || []).map(p => ({
      ...p,
      billId: p.bill_id,
      method: p.method || "cash",
      amount: Number(p.amount) || 0,
      paidAt: p.paid_at,
    }));
  },

  async addBillPayment(payment) {
    const row = {
      bill_id: payment.billId,
      organisation_id: payment.organisationId,
      method: payment.method || "cash",
      amount: payment.amount,
      note: payment.note || null,
    };
    const { data, error } = await supabase.from("bill_payments").insert([row]).select("*").single();
    if (error) {
      console.error("addBillPayment:", error.message);
      return null;
    }
    return { ...data, billId: data.bill_id, paidAt: data.paid_at };
  },

  async deleteBillPayment(id) {
    const { error } = await supabase.from("bill_payments").delete().eq("id", id);
    if (error) console.error("deleteBillPayment:", error.message);
  },

  // PURCHASES
  async getPurchases(organisationId) {
    let q = supabase.from("purchases").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getPurchases:", error.message);
      return [];
    }

    return (data || []).map(p => {
      let items = [];
      if (p.items_json) {
        try {
          const parsed = JSON.parse(p.items_json);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          // ignore JSON parse errors and keep items as []
        }
      }
      return {
        ...p,
        createdAt: p.created_at,
        billDate: p.bill_date ?? null,
        billImage: p.bill_image ?? null,
        ocrText: p.ocr_text ?? null,
        items,
      };
    });
  },

  async addPurchase(purchase) {
    console.log("[Supabase] INSERT purchase → starting", purchase);
    const baseRow = {
      id: purchase.id,
      supplier: purchase.supplier,
      item: purchase.item,
      qty: purchase.qty,
      rate: purchase.rate,
      total: purchase.total,
      notes: purchase.notes || null,
    };
    if (purchase.organisationId) baseRow.organisation_id = purchase.organisationId;
    if (purchase.billDate) baseRow.bill_date = purchase.billDate;
    if (purchase.billImage) baseRow.bill_image = purchase.billImage;
    if (purchase.ocrText) baseRow.ocr_text = purchase.ocrText;
    if (purchase.items && Array.isArray(purchase.items) && purchase.items.length > 0) {
      baseRow.items_json = JSON.stringify(purchase.items);
    }

    let row = baseRow;
    let { data, error } = await supabase
      .from("purchases")
      .insert([row])
      .select()
      .single();

    if (error && /column .* does not exist/i.test(error.message || "")) {
      // Fallback for older schemas without bill metadata columns
      console.warn("[Supabase] addPurchase → retry without bill metadata columns");
      row = { ...baseRow };
      delete row.bill_date;
      delete row.bill_image;
      delete row.ocr_text;
      delete row.items_json;
      ({ data, error } = await supabase
        .from("purchases")
        .insert([row])
        .select()
        .single());
    }

    if (error) {
      console.error("addPurchase:", error.message);
      return null;
    }

    console.log("[Supabase] INSERT purchase → ok", { id: data.id });
    return {
      ...data,
      createdAt: data.created_at,
      billDate: data.bill_date ?? null,
      billImage: data.bill_image ?? null,
      ocrText: data.ocr_text ?? null,
      items: (() => {
        if (!data.items_json) return [];
        try {
          const parsed = JSON.parse(data.items_json);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })(),
    };
  },

  async deletePurchase(id) {
    console.log("[Supabase] DELETE purchase → starting", { id });
    const { error } = await supabase
      .from("purchases")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deletePurchase:", error.message);
    } else {
      console.log("[Supabase] DELETE purchase → ok", { id });
    }
  },

  // TASKS
  async getTasks(organisationId) {
    let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getTasks:", error.message);
      return [];
    }

    return (data || []).map(t => ({
      ...t,
      worker: t.worker ?? t.worker_id ?? null,
      vendor: t.vendor_id ?? null,
      createdAt: t.created_at,
    }));
  },

  async addTask(task) {
    console.log("[Supabase] INSERT task → starting", task);
    const row = {
      id: task.id,
      title: task.title,
      customer: task.customer,
      worker_id: task.worker || null,
      vendor_id: task.vendor || null,
      deadline: task.deadline || null,
      status: task.status,
      notes: task.notes,
    };
    if (task.organisationId) row.organisation_id = task.organisationId;
    const { data, error } = await supabase
      .from("tasks")
      .insert([row])
      .select()
      .single();

    if (error) {
      console.error("addTask:", error.message);
      return null;
    }

    console.log("[Supabase] INSERT task → ok", { id: data.id });

    return {
      ...data,
      worker: data.worker ?? data.worker_id ?? task.worker,
      createdAt: data.created_at,
    };
  },

  async updateTaskStatus(id, status) {
    console.log("[Supabase] UPDATE task.status → starting", { id, status });
    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error("updateTaskStatus:", error.message);
    } else {
      console.log("[Supabase] UPDATE task.status → ok", { id, status });
    }
  },

  async updateTask(id, updates) {
    const { title, customer, deadline, notes } = updates;
    const payload = {};
    if (title !== undefined) payload.title = title;
    if (customer !== undefined) payload.customer = customer;
    if (deadline !== undefined) payload.deadline = deadline || null;
    if (notes !== undefined) payload.notes = notes;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (error) console.error("updateTask:", error.message);
  },

  async deleteTask(id) {
    console.log("[Supabase] DELETE task → starting", { id });
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteTask:", error.message);
    } else {
      console.log("[Supabase] DELETE task → ok", { id });
    }
  },

  // CUSTOMERS
  async getCustomers(organisationId) {
    let q = supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getCustomers:", error.message);
      return [];
    }

    return (data || []).map(c => ({ ...c, createdAt: c.created_at }));
  },

  async addCustomer(customer) {
    console.log("[Supabase] UPSERT customer → starting", customer);
    const uuidLike = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));
    const row = {
      ...(customer.id && uuidLike(customer.id) ? { id: customer.id } : {}),
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      gstin: customer.gstin ?? customer.customerGstin ?? null,
      pan_number: customer.panNumber ?? customer.pan_number ?? null,
      billing_address: customer.billingAddress ?? customer.billing_address ?? customer.customerAddress ?? null,
      shipping_address: customer.shippingAddress ?? customer.shipping_address ?? customer.shipToAddress ?? null,
      state: customer.state ?? customer.placeOfSupply ?? null,
      opening_balance: customer.openingBalance ?? customer.opening_balance ?? 0,
      balance_type: customer.balanceType ?? customer.balance_type ?? "to_collect",
      credit_period_days: customer.creditPeriodDays ?? customer.credit_period_days ?? null,
      credit_limit: customer.creditLimit ?? customer.credit_limit ?? null,
      contact_person_name: customer.contactPersonName ?? customer.contact_person_name ?? null,
      date_of_birth: customer.dateOfBirth ?? customer.date_of_birth ?? null,
      party_type: customer.partyType ?? customer.party_type ?? "customer",
      party_category: customer.partyCategory ?? customer.party_category ?? null,
    };
    if (customer.organisationId) row.organisation_id = customer.organisationId;
    const { error } = await supabase
      .from("customers")
      .upsert([row], { onConflict: "phone" });

    if (error) {
      console.error("addCustomer:", error.message);
    } else {
      console.log("[Supabase] UPSERT customer → ok", { phone: customer.phone });
    }
  },

  async updateCustomer(id, updates) {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.gstin !== undefined || updates.customerGstin !== undefined) payload.gstin = updates.gstin ?? updates.customerGstin;
    if (updates.panNumber !== undefined || updates.pan_number !== undefined) payload.pan_number = updates.panNumber ?? updates.pan_number;
    if (updates.billingAddress !== undefined || updates.billing_address !== undefined || updates.customerAddress !== undefined) payload.billing_address = updates.billingAddress ?? updates.billing_address ?? updates.customerAddress;
    if (updates.shippingAddress !== undefined || updates.shipping_address !== undefined || updates.shipToAddress !== undefined) payload.shipping_address = updates.shippingAddress ?? updates.shipping_address ?? updates.shipToAddress;
    if (updates.state !== undefined || updates.placeOfSupply !== undefined) payload.state = updates.state ?? updates.placeOfSupply;
    if (updates.openingBalance !== undefined || updates.opening_balance !== undefined) payload.opening_balance = updates.openingBalance ?? updates.opening_balance;
    if (updates.balanceType !== undefined || updates.balance_type !== undefined) payload.balance_type = updates.balanceType ?? updates.balance_type;
    if (updates.creditPeriodDays !== undefined || updates.credit_period_days !== undefined) payload.credit_period_days = updates.creditPeriodDays ?? updates.credit_period_days;
    if (updates.creditLimit !== undefined || updates.credit_limit !== undefined) payload.credit_limit = updates.creditLimit ?? updates.credit_limit;
    if (updates.contactPersonName !== undefined || updates.contact_person_name !== undefined) payload.contact_person_name = updates.contactPersonName ?? updates.contact_person_name;
    if (updates.dateOfBirth !== undefined || updates.date_of_birth !== undefined) payload.date_of_birth = updates.dateOfBirth ?? updates.date_of_birth;
    if (updates.partyType !== undefined || updates.party_type !== undefined) payload.party_type = updates.partyType ?? updates.party_type;
    if (updates.partyCategory !== undefined || updates.party_category !== undefined) payload.party_category = updates.partyCategory ?? updates.party_category;
    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from("customers").update(payload).eq("id", id);
    if (error) console.error("updateCustomer:", error.message);
  },

  // PRODUCTS / SERVICES
  async getProducts(organisationId) {
    let q = supabase.from("products").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getProducts:", error.message);
      return [];
    }

    return (data || []).map(p => ({
      ...p,
      createdAt: p.created_at,
    }));
  },

  async addProduct(product) {
    const row = {
      name: product.name,
      category: product.category || "product",
      item_code: product.itemCode ?? product.item_code ?? null,
      hsn_code: product.hsnCode ?? product.hsn_code ?? null,
      unit: product.unit || null,
      default_rate: product.defaultRate ?? product.default_rate ?? 0,
      tax_rate: product.taxRate ?? product.tax_rate ?? 0,
      purchase_price: product.purchasePrice ?? product.purchase_price ?? 0,
      opening_stock: product.openingStock ?? product.opening_stock ?? 0,
      stock_as_of: product.stockAsOf ?? product.stock_as_of ?? null,
      description: product.description ?? null,
      size: product.size ?? null,
      active: product.active !== false,
    };
    if (product.organisationId) row.organisation_id = product.organisationId;

    console.log("[Supabase] INSERT product → starting", row);
    const { data, error } = await supabase
      .from("products")
      .insert([row])
      .select("*")
      .single();

    if (error) {
      console.error("addProduct:", error.message);
      throw new Error(error.message);
    }

    return {
      ...data,
      createdAt: data.created_at,
    };
  },

  async updateProduct(id, updates) {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.itemCode !== undefined || updates.item_code !== undefined) payload.item_code = updates.itemCode ?? updates.item_code;
    if (updates.hsnCode !== undefined || updates.hsn_code !== undefined) payload.hsn_code = updates.hsnCode ?? updates.hsn_code;
    if (updates.unit !== undefined) payload.unit = updates.unit;
    if (updates.defaultRate !== undefined || updates.default_rate !== undefined) {
      payload.default_rate = updates.defaultRate ?? updates.default_rate;
    }
    if (updates.taxRate !== undefined || updates.tax_rate !== undefined) {
      payload.tax_rate = updates.taxRate ?? updates.tax_rate;
    }
    if (updates.purchasePrice !== undefined || updates.purchase_price !== undefined) {
      payload.purchase_price = updates.purchasePrice ?? updates.purchase_price;
    }
    if (updates.openingStock !== undefined || updates.opening_stock !== undefined) {
      payload.opening_stock = updates.openingStock ?? updates.opening_stock;
    }
    if (updates.stockAsOf !== undefined || updates.stock_as_of !== undefined) {
      payload.stock_as_of = updates.stockAsOf ?? updates.stock_as_of;
    }
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.size !== undefined) payload.size = updates.size;
    if (updates.active !== undefined) payload.active = updates.active;
    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) console.error("updateProduct:", error.message);
  },

  async deleteProduct(id) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) console.error("deleteProduct:", error.message);
  },

  // BRAND / SETTINGS — cloud-first, single-row table (per org when organisationId provided)
  async saveBrand(brand, organisationId) {
    // ── Persist appearance settings to localStorage so they survive refresh
    // even if the DB columns don't exist yet on this deployment.
    try {
      const appearanceCache = {
        bgImage: brand.bgImage ?? null,
        bgColor: brand.bgColor ?? "",
        sidebarColor: brand.sidebarColor ?? "",
        bgBlur: brand.bgBlur ?? false,
      };
      localStorage.setItem("pm_appearance", JSON.stringify(appearanceCache));
    } catch (e) { /* localStorage not available */ }

    // Map React brand state → DB columns
    const payload = {
      shop_name: brand.shopName ?? null,
      address: brand.address ?? null,
      phone: brand.phone ?? null,
      whatsapp: brand.whatsapp ?? null,
      gmail: brand.gmail ?? null,
      state: brand.state ?? null,
      gst_number: brand.gstNumber ?? null,
      pan_number: brand.panNumber ?? null,
      bank_name: brand.bankName ?? null,
      account_name: brand.accountName ?? null,
      account_number: brand.accountNumber ?? null,
      ifsc_code: brand.ifscCode ?? null,
      branch_name: brand.branchName ?? null,
      authorised_signatory: brand.authorisedSignatory ?? null,
      logo: brand.logo ?? null,
      payment_qr: brand.paymentQr ?? null,
      payment_qr_locked: brand.paymentQrLocked ?? false,
      upi_id: brand.upiId ?? null,
      invoice_prefix: brand.invoicePrefix ?? null,
      invoice_counter: Math.min(Number(brand.invoiceCounter) || 1, 2147483647),
      // Optional columns (newer DB schema). Retry without if missing.
      invoice_print_type: brand.invoicePrintType ?? null,
      thermal_paper_mm: brand.thermalPaperMm ?? null,
      default_billing_method: brand.defaultBillingMethod ?? "modern",
      // Appearance customization columns (added via migration)
      bg_image: brand.bgImage ?? null,
      bg_color: brand.bgColor ?? null,
      sidebar_color: brand.sidebarColor ?? null,
      bg_blur: brand.bgBlur ?? false,
    };
    if (organisationId) payload.organisation_id = organisationId;

    // Never insert on load — only on explicit save
    console.log("[Supabase] saveBrand → select existing settings row");
    let q = supabase.from("settings").select("id");
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data: existing, error: selectError } = await q.limit(1).maybeSingle();

    if (selectError) {
      console.error("saveBrand select existing:", selectError.message);
      return;
    }

    if (existing?.id) {
      console.log("[Supabase] UPDATE settings → starting", { id: existing.id, payload });
      let { error: updateError } = await supabase
        .from("settings")
        .update(payload)
        .eq("id", existing.id);

      // Smart retry: remove only the specific failing column first, so other optional
      // columns (like default_billing_method) still get saved when possible.
      if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
        const failCol = (updateError.message.match(/column ["']?(\w+)["']? does not exist/i) || [])[1];
        const fallback = { ...payload };
        if (failCol) delete fallback[failCol];
        const { error: retryErr } = await supabase.from("settings").update(fallback).eq("id", existing.id);
        updateError = retryErr;
        // If still failing, strip all optional new columns
        if (updateError && /column .* does not exist/i.test(updateError.message || "")) {
          const safe = { ...fallback };
          delete safe.invoice_print_type;
          delete safe.thermal_paper_mm;
          delete safe.default_billing_method;
          delete safe.bg_image;
          delete safe.bg_color;
          delete safe.sidebar_color;
          delete safe.bg_blur;
          console.warn("[Supabase] UPDATE settings → retry without all optional columns");
          ({ error: updateError } = await supabase.from("settings").update(safe).eq("id", existing.id));
        }
      }

      if (updateError) {
        console.error("saveBrand update:", updateError.message);
      } else {
        console.log("[Supabase] UPDATE settings → ok", { id: existing.id });
      }
    } else {
      console.log("[Supabase] INSERT settings → starting", payload);
      let { data: inserted, error: insertError } = await supabase
        .from("settings")
        .insert([payload])
        .select("id")
        .single();

      if (insertError && /column .* does not exist/i.test(insertError.message || "")) {
        const failCol = (insertError.message.match(/column ["']?(\w+)["']? does not exist/i) || [])[1];
        const fallback = { ...payload };
        if (failCol) delete fallback[failCol];
        const { data: retryData, error: retryErr } = await supabase.from("settings").insert([fallback]).select("id").single();
        inserted = retryData;
        insertError = retryErr;
        if (insertError && /column .* does not exist/i.test(insertError.message || "")) {
          const safe = { ...fallback };
          delete safe.invoice_print_type;
          delete safe.thermal_paper_mm;
          delete safe.default_billing_method;
          delete safe.bg_image;
          delete safe.bg_color;
          delete safe.sidebar_color;
          delete safe.bg_blur;
          console.warn("[Supabase] INSERT settings → retry without all optional columns");
          ({ data: inserted, error: insertError } = await supabase.from("settings").insert([safe]).select("id").single());
        }
      }

      if (insertError) {
        console.error("saveBrand insert:", insertError.message);
      } else {
        console.log("[Supabase] INSERT settings → ok", { id: inserted?.id });
      }
    }
  },

  async loadBrand(defaults, organisationId) {
    // Database is the single source of truth; no localStorage.
    console.log("[Supabase] SELECT settings (loadBrand) → starting");
    let q = supabase.from("settings").select("*");
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q.limit(1).maybeSingle();

    if (error) {
      console.error("loadBrand:", error.message);
      return defaults;
    }

    if (!data) {
      // No row yet: use in-memory defaults only, do NOT auto-insert into DB.
      console.log("[Supabase] SELECT settings (loadBrand) → no row, using defaults only");
      return defaults;
    }

    // ── Load appearance from localStorage as fast fallback (works even if DB
    // columns don't exist yet). DB values override localStorage when present.
    let appearanceCache = {};
    try {
      const raw = localStorage.getItem("pm_appearance");
      if (raw) appearanceCache = JSON.parse(raw);
    } catch (e) { /* ignore */ }

    const merged = {
      ...defaults,
      shopName: data.shop_name ?? defaults.shopName,
      address: data.address ?? defaults.address,
      phone: data.phone ?? defaults.phone,
      whatsapp: data.whatsapp ?? defaults.whatsapp,
      gmail: data.gmail ?? defaults.gmail,
      state: data.state ?? defaults.state,
      gstNumber: data.gst_number ?? defaults.gstNumber,
      panNumber: data.pan_number ?? defaults.panNumber,
      bankName: data.bank_name ?? defaults.bankName,
      accountName: data.account_name ?? defaults.accountName,
      accountNumber: data.account_number ?? defaults.accountNumber,
      ifscCode: data.ifsc_code ?? defaults.ifscCode,
      branchName: data.branch_name ?? defaults.branchName,
      authorisedSignatory: data.authorised_signatory ?? defaults.authorisedSignatory,
      logo: data.logo ?? defaults.logo,
      paymentQr: data.payment_qr ?? defaults.paymentQr,
      paymentQrLocked: data.payment_qr_locked ?? defaults.paymentQrLocked,
      upiId: data.upi_id ?? defaults.upiId,
      invoicePrefix: data.invoice_prefix ?? defaults.invoicePrefix,
      invoiceCounter: data.invoice_counter ?? defaults.invoiceCounter,
      invoicePrintType: data.invoice_print_type ?? defaults.invoicePrintType,
      thermalPaperMm: data.thermal_paper_mm ?? defaults.thermalPaperMm,
      defaultBillingMethod: data.default_billing_method ?? defaults.defaultBillingMethod,
      // Appearance: DB columns preferred, localStorage as fallback
      bgImage: data.bg_image ?? appearanceCache.bgImage ?? defaults.bgImage ?? null,
      bgColor: data.bg_color ?? appearanceCache.bgColor ?? defaults.bgColor ?? "",
      sidebarColor: data.sidebar_color ?? appearanceCache.sidebarColor ?? defaults.sidebarColor ?? "",
      bgBlur: data.bg_blur ?? appearanceCache.bgBlur ?? defaults.bgBlur ?? false,
    };

    console.log("[Supabase] SELECT settings (loadBrand) → ok");
    return merged;
  },

  // WORKERS — uuid primary key (gen_random_uuid()) in DB
  async getWorkers(organisationId) {
    // Exclude password column — hashed values have no use on the client
    let q = supabase.from("workers").select("id, name, username, role, phone, salary_type, salary_amount, salary_cycle, opening_balance, organisation_id, created_at");
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getWorkers:", error.message);
      return [];
    }

    return data || [];
  },

  async addWorker(worker) {
    const hashedPassword = await hashPasswordForStorage(worker.password);
    const payload = {
      name: worker.name,
      username: worker.username,
      password: hashedPassword,
      role: worker.role || "worker",
      phone: worker.phone || null,
      salary_type: worker.salaryType || 'Monthly',
      salary_amount: worker.salaryAmount || 0,
      salary_cycle: worker.salaryCycle || '1 to 1 Every month',
      opening_balance: worker.openingBalance || 0,
    };
    if (worker.organisationId) payload.organisation_id = worker.organisationId;

    console.log("[Supabase] INSERT worker → starting", { ...payload, password: "[hashed]" });
    const { data, error } = await supabase
      .from("workers")
      .insert([payload])
      .select("id, name, username, role, phone, salary_type, salary_amount, salary_cycle, opening_balance, organisation_id, created_at")
      .single();

    if (error) {
      console.error("addWorker:", error.message);
      return null;
    }

    console.log("[Supabase] INSERT worker → ok", { id: data.id });
    return data;
  },

  async deleteWorker(id) {
    console.log("[Supabase] DELETE worker → starting", { id });
    const { error } = await supabase
      .from("workers")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteWorker:", error.message);
    } else {
      console.log("[Supabase] DELETE worker → ok", { id });
    }
  },

  async updateWorkerPassword(id, password) {
    console.log("[Supabase] UPDATE worker.password → starting", { id });
    const hashedPassword = await hashPasswordForStorage(password);
    const { error } = await supabase
      .from("workers")
      .update({ password: hashedPassword })
      .eq("id", id);

    if (error) {
      console.error("updateWorkerPassword:", error.message);
    } else {
      console.log("[Supabase] UPDATE worker.password → ok", { id });
    }
  },

  async updateWorker(id, updates) {
    const payload = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.username !== undefined) payload.username = updates.username;
    if (updates.password !== undefined) payload.password = await hashPasswordForStorage(updates.password);
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.salaryType !== undefined) payload.salary_type = updates.salaryType;
    if (updates.salaryAmount !== undefined) payload.salary_amount = updates.salaryAmount;
    if (updates.salaryCycle !== undefined) payload.salary_cycle = updates.salaryCycle;
    if (updates.openingBalance !== undefined) payload.opening_balance = updates.openingBalance;
    if (Object.keys(payload).length === 0) return;

    const { error } = await supabase.from("workers").update(payload).eq("id", id);
    if (error) console.error("updateWorker:", error.message);
  },

  async getWorkerAttendance(workerId) {
    const { data, error } = await supabase.from("worker_attendance").select("*").eq("worker_id", workerId);
    if (error) {
      console.error("getWorkerAttendance:", error.message);
      return [];
    }
    return data || [];
  },

  async upsertWorkerAttendance(attendanceList) {
    if (!attendanceList.length) return;
    const { error } = await supabase.from("worker_attendance").upsert(attendanceList, { onConflict: "worker_id, date" });
    if (error) console.error("upsertWorkerAttendance:", error.message);
  },

  async getWorkerTransactions(workerId) {
    const { data, error } = await supabase.from("worker_transactions").select("*").eq("worker_id", workerId).order("date", { ascending: false });
    if (error) {
      console.error("getWorkerTransactions:", error.message);
      return [];
    }
    return data || [];
  },

  async addWorkerTransaction(txn) {
    const payload = {
      worker_id: txn.workerId,
      organisation_id: txn.organisationId,
      type: txn.type,
      amount: txn.amount,
      note: txn.note || null,
      date: txn.date || new Date().toISOString()
    };
    const { data, error } = await supabase.from("worker_transactions").insert([payload]).select("*").single();
    if (error) {
      console.error("addWorkerTransaction:", error.message);
      return null;
    }
    return data;
  },

  // VENDORS
  async getVendors(organisationId) {
    // Exclude password column — hashed values have no use on the client
    let q = supabase.from("vendors").select("id, name, firm_name, username, phone, email, organisation_id, created_at").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getVendors:", error.message);
      return [];
    }
    return (data || []).map(v => ({ ...v, createdAt: v.created_at }));
  },

  async addVendor(vendor) {
    const hashedPassword = await hashPasswordForStorage(vendor.password);
    const payload = {
      name: vendor.name,
      firm_name: vendor.firmName || null,
      username: vendor.username,
      password: hashedPassword,
      phone: vendor.phone || null,
      email: vendor.email || null,
    };
    if (vendor.organisationId) payload.organisation_id = vendor.organisationId;
    console.log("[Supabase] INSERT vendor → starting", { ...payload, password: "[hashed]" });
    const { data, error } = await supabase
      .from("vendors")
      .insert([payload])
      .select("id, name, firm_name, username, phone, email, organisation_id, created_at")
      .single();

    if (error) {
      console.error("[Supabase] addVendor error:", error.message, error.details);
      throw new Error(error.message);
    }
    console.log("[Supabase] INSERT vendor → ok", { id: data.id });
    return { ...data, id: data.id, createdAt: data.created_at };
  },

  async deleteVendor(id) {
    const { error } = await supabase.from("vendors").delete().eq("id", id);
    if (error) console.error("deleteVendor:", error.message);
  },

  async updateVendorPassword(id, password) {
    const hashedPassword = await hashPasswordForStorage(password);
    const { error } = await supabase
      .from("vendors")
      .update({ password: hashedPassword })
      .eq("id", id);
    if (error) console.error("updateVendorPassword:", error.message);
  },

  // VENDOR BILLS (bills FROM vendors TO our company)
  async getVendorBills(organisationId) {
    let q = supabase.from("vendor_bills").select("*").order("created_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;

    if (error) {
      console.error("getVendorBills:", error.message);
      return [];
    }
    return (data || []).map(normalizeVendorBill).filter(Boolean);
  },

  async addVendorBill(bill) {
    const fullPayload = {
      id: bill.id,
      vendor_id: bill.vendorId,
      description: bill.description,
      amount: bill.amount,
      paid: bill.paid || false,
    };
    if (bill.organisationId) fullPayload.organisation_id = bill.organisationId;

    // Try the "expected" schema first (vendor_tables.sql)
    let res = await supabase.from("vendor_bills").insert([fullPayload]).select("*").single();

    // If the table schema is different (common: uses bill_number instead of id, or missing paid/description),
    // retry with a more compatible payload.
    if (res.error) {
      const msg = res.error.message || "";
      const schemaCache = msg.includes("schema cache") || msg.includes("Could not find");

      if (schemaCache) {
        // Variant A: bill_number column instead of id
        const payloadA = {
          bill_number: bill.id,
          vendor_id: bill.vendorId,
          description: bill.description,
          amount: bill.amount,
          paid: bill.paid || false,
        };
        res = await supabase.from("vendor_bills").insert([payloadA]).select("*").single();

        // Variant B: no description/paid columns
        if (res.error) {
          const payloadB = {
            bill_number: bill.id,
            vendor_id: bill.vendorId,
            amount: bill.amount,
          };
          res = await supabase.from("vendor_bills").insert([payloadB]).select("*").single();
        }
      }
    }

    if (res.error) {
      console.error("addVendorBill:", res.error.message);
      return null;
    }

    return normalizeVendorBill(res.data);
  },

  async updateVendorBillPaid(id, paid) {
    // Try primary schema: id column
    let res = await supabase.from("vendor_bills").update({ paid }).eq("id", id);
    if (res.error) {
      const msg = res.error.message || "";
      const schemaCache = msg.includes("schema cache") || msg.includes("Could not find");
      if (schemaCache) {
        // Variant schema: bill_number column
        res = await supabase.from("vendor_bills").update({ paid }).eq("bill_number", id);
      }
    }
    if (res.error) {
      console.error("updateVendorBillPaid:", res.error.message);
    }
  },

  // VENDOR PAYMENTS (what we pay to vendors)
  async getVendorPayments(organisationId) {
    let q = supabase.from("vendor_payments").select("*").order("paid_at", { ascending: false });
    if (organisationId) q = q.eq("organisation_id", organisationId);
    const { data, error } = await q;
    if (error) {
      console.error("getVendorPayments:", error.message);
      return [];
    }
    return (data || []).map(p => ({
      ...p,
      vendorBillId: p.vendor_bill_id,
      method: p.method || "cash",
      amount: Number(p.amount) || 0,
      paidAt: p.paid_at,
    }));
  },

  async getPaymentsForVendorBill(vendorBillId) {
    const { data, error } = await supabase
      .from("vendor_payments")
      .select("*")
      .eq("vendor_bill_id", vendorBillId)
      .order("paid_at", { ascending: true });
    if (error) {
      console.error("getPaymentsForVendorBill:", error.message);
      return [];
    }
    return (data || []).map(p => ({
      ...p,
      vendorBillId: p.vendor_bill_id,
      method: p.method || "cash",
      amount: Number(p.amount) || 0,
      paidAt: p.paid_at,
    }));
  },

  async addVendorPayment(payment) {
    const row = {
      vendor_bill_id: payment.vendorBillId,
      organisation_id: payment.organisationId,
      method: payment.method || "cash",
      amount: payment.amount,
      note: payment.note || null,
    };
    const { data, error } = await supabase.from("vendor_payments").insert([row]).select("*").single();
    if (error) {
      console.error("addVendorPayment:", error.message);
      return null;
    }
    return { ...data, vendorBillId: data.vendor_bill_id, paidAt: data.paid_at };
  },

  async deleteVendorPayment(id) {
    const { error } = await supabase.from("vendor_payments").delete().eq("id", id);
    if (error) console.error("deleteVendorPayment:", error.message);
  },
};

// Realtime subscription for task assignments (workers & vendors)
export function subscribeToTaskAssignments(userId, role, onTask) {
  if (!userId || typeof onTask !== "function") {
    return () => {};
  }

  try {
    const channel = supabase
      .channel(`tasks-assign-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          // Filter by worker_id / vendor_id when possible
          filter:
            role === "worker"
              ? `worker_id=eq.${userId}`
              : role === "vendor"
              ? `vendor_id=eq.${userId}`
              : undefined,
        },
        (payload) => {
          const row = payload.new || payload.record || payload;
          if (!row) return;

          const task = {
            ...row,
            worker: row.worker ?? row.worker_id ?? null,
            vendor: row.vendor_id ?? null,
            createdAt: row.created_at,
          };

          try {
            onTask(task);
          } catch (err) {
            console.error("subscribeToTaskAssignments callback error:", err);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIPTION_ERROR") {
          console.error("subscribeToTaskAssignments subscription error");
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.error("subscribeToTaskAssignments cleanup error:", err);
      }
    };
  } catch (err) {
    console.error("subscribeToTaskAssignments setup error:", err);
    return () => {};
  }
}
