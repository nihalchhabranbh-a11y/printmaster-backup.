import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://vajskkpzezplpxyvsuym.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_v1JqrFn0EkNsn_52GnZkTQ_IKMQfYT4";

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── Database helpers ─────────────────────────────────────────────
export const db = {

  // BILLS
  async getBills() {
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getBills:", error.message);
      return [];
    }

    return data.map(b => ({
      ...b,
      gstAmt: b.gst_amt,
      createdAt: b.created_at,
      desc: b.description || b.desc,
    }));
  },

  async addBill(bill) {
    const { data, error } = await supabase
      .from("bills")
      .insert([{
        id: bill.id,
        customer: bill.customer,
        phone: bill.phone,
        email: bill.email,
        description: bill.desc,
        size: bill.size,
        qty: bill.qty,
        rate: bill.rate,
        subtotal: bill.subtotal,
        gst_amt: bill.gstAmt,
        total: bill.total,
        gst: bill.gst,
        paid: bill.paid,
      }])
      .select()
      .single();

    if (error) {
      console.error("addBill:", error.message);
      return null;
    }

    return {
      ...data,
      desc: data.description,
      gstAmt: data.gst_amt,
      createdAt: data.created_at,
    };
  },

  async updateBillPaid(id, paid) {
    const { error } = await supabase
      .from("bills")
      .update({ paid })
      .eq("id", id);

    if (error) console.error("updateBillPaid:", error.message);
  },

  async deleteBill(id) {
    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", id);

    if (error) console.error("deleteBill:", error.message);
  },

  // TASKS
  async getTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getTasks:", error.message);
      return [];
    }

    return data.map(t => ({
      ...t,
      createdAt: t.created_at,
    }));
  },

  async addTask(task) {
    const { data, error } = await supabase
      .from("tasks")
      .insert([{
        id: task.id,
        title: task.title,
        customer: task.customer,
        worker: task.worker,
        deadline: task.deadline || null,
        status: task.status,
        notes: task.notes,
      }])
      .select()
      .single();

    if (error) {
      console.error("addTask:", error.message);
      return null;
    }

    return { ...data, createdAt: data.created_at };
  },

  async updateTaskStatus(id, status) {
    const { error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", id);

    if (error) console.error("updateTaskStatus:", error.message);
  },

  async deleteTask(id) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) console.error("deleteTask:", error.message);
  },

  // CUSTOMERS
  async getCustomers() {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getCustomers:", error.message);
      return [];
    }

    return data.map(c => ({ ...c, createdAt: c.created_at }));
  },

  async addCustomer(customer) {
    const { error } = await supabase
      .from("customers")
      .upsert([{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      }], { onConflict: "phone" });

    if (error) console.error("addCustomer:", error.message);
  },

  // BRAND — saved in Supabase settings table
  async saveBrand(brand) {
    // Strip base64 images from DB save — keep them in localStorage only
    const toSave = { ...brand, logo: null, paymentQr: null };
    const { error } = await supabase
      .from("settings")
      .upsert([{ key: "brand", value: toSave }], { onConflict: "key" });

    if (error) console.error("saveBrand:", error.message);

    // Still save full brand (with images) locally
    try { localStorage.setItem("pm_brand", JSON.stringify(brand)); } catch {}
  },

  async loadBrand(defaults) {
    // First try localStorage (has logo/QR images)
    let local = defaults;
    try {
      const s = localStorage.getItem("pm_brand");
      if (s) local = { ...defaults, ...JSON.parse(s) };
    } catch {}

    // Then fetch DB settings to get latest shop info
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "brand")
        .single();

      if (data?.value) {
        return { ...local, ...data.value, logo: local.logo, paymentQr: local.paymentQr };
      }
    } catch {}

    return local;
  },
};
