import { useMemo, useState } from "react";
import { db } from "./supabase.js";

const emptyForm = () => ({
  name: "",
  phone: "",
  email: "",
  gstin: "",
  panNumber: "",
  state: "",
  billingAddress: "",
  shippingAddress: "",
  openingBalance: 0,
  balanceType: "to_collect",
  creditPeriodDays: 30,
  creditLimit: 0,
  contactPersonName: "",
  dateOfBirth: "",
  partyType: "customer",
  partyCategory: "",
});

const fmtCur = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EnhancedCustomersPage({ customers, setCustomers, bills, showToast, user }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const mergedCustomers = useMemo(() => {
    const fromBills = Object.values(
      (bills || []).reduce((acc, b) => {
        const key = (String(b.phone || "").replace(/\D/g, "") || (b.customer || "").trim().toLowerCase());
        if (!key) return acc;
        if (!acc[key]) {
          acc[key] = {
            id: key,
            name: b.customer || "Customer",
            phone: b.phone || "",
            email: b.email || "",
            gstin: b.customerGstin || "",
            billingAddress: b.customerAddress || "",
            shippingAddress: b.shipToAddress || "",
            state: b.placeOfSupply || "",
          };
        }
        return acc;
      }, {})
    );
    const map = new Map();
    fromBills.forEach((c) => map.set(String(c.phone || "").replace(/\D/g, "") || (c.name || "").toLowerCase(), c));
    (customers || []).forEach((c) => {
      const key = String(c.phone || "").replace(/\D/g, "") || (c.name || "").toLowerCase() || c.id;
      if (!key) return;
      map.set(key, { ...(map.get(key) || {}), ...c });
    });
    return Array.from(map.values());
  }, [bills, customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mergedCustomers;
    return mergedCustomers.filter((c) =>
      [c.name, c.phone, c.email, c.gstin, c.state]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [mergedCustomers, search]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (party) => {
    setEditing(party);
    setForm({
      name: party.name || "",
      phone: party.phone || "",
      email: party.email || "",
      gstin: party.gstin || party.customerGstin || "",
      panNumber: party.pan_number || party.panNumber || "",
      state: party.state || "",
      billingAddress: party.billing_address || party.billingAddress || party.customerAddress || "",
      shippingAddress: party.shipping_address || party.shippingAddress || party.shipToAddress || "",
      openingBalance: party.opening_balance ?? party.openingBalance ?? 0,
      balanceType: party.balance_type || party.balanceType || "to_collect",
      creditPeriodDays: party.credit_period_days ?? party.creditPeriodDays ?? 30,
      creditLimit: party.credit_limit ?? party.creditLimit ?? 0,
      contactPersonName: party.contact_person_name || party.contactPersonName || "",
      dateOfBirth: party.date_of_birth || party.dateOfBirth || "",
      partyType: party.party_type || party.partyType || "customer",
      partyCategory: party.party_category || party.partyCategory || "",
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showToast("Enter party name", "error");
      return;
    }
    const payload = {
      name: form.name.trim(),
      phone: String(form.phone || "").replace(/\D/g, ""),
      email: form.email.trim() || null,
      gstin: form.gstin.trim().toUpperCase() || null,
      panNumber: form.panNumber.trim().toUpperCase() || null,
      state: form.state.trim() || null,
      billingAddress: form.billingAddress.trim() || null,
      shippingAddress: form.shippingAddress.trim() || null,
      openingBalance: Number(form.openingBalance) || 0,
      balanceType: form.balanceType,
      creditPeriodDays: Number(form.creditPeriodDays) || 0,
      creditLimit: Number(form.creditLimit) || 0,
      contactPersonName: form.contactPersonName.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      partyType: form.partyType,
      partyCategory: form.partyCategory.trim() || null,
      organisationId: user?.organisationId,
    };
    try {
      if (editing?.id && String(editing.id).includes("-")) {
        await db.updateCustomer(editing.id, payload);
        setCustomers((list) => list.map((c) => (c.id === editing.id ? { ...c, ...payload } : c)));
      } else {
        await db.addCustomer(payload);
        setCustomers((list) => [{ id: payload.phone || payload.name, ...payload }, ...list]);
      }
      showToast("Party saved");
      setShowModal(false);
      resetForm();
    } catch (e) {
      showToast(e.message || "Failed to save party", "error");
    }
  };

  const selectedBills = (bills || []).filter((b) => {
    if (!selected) return false;
    const billPhone = String(b.phone || "").replace(/\D/g, "");
    const selectedPhone = String(selected.phone || "").replace(/\D/g, "");
    return (selectedPhone && billPhone === selectedPhone) || ((b.customer || "").toLowerCase() === (selected.name || "").toLowerCase());
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ gap: 10, flexWrap: "wrap" }}>
        <div className="search-bar" style={{ width: 300 }}>
          <input placeholder="Search parties..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}>Create Party</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1.1fr .9fr" : "1fr", gap: 16 }}>
        <div className="card">
          <div className="card-title">Parties</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Party Name</th>
                  <th>Phone</th>
                  <th>GSTIN</th>
                  <th>State</th>
                  <th>Opening Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--text3)" }}>
                      No parties yet. Add customer GST, addresses, credit period, and opening balance here.
                    </td>
                  </tr>
                ) : (
                  filtered.map((party) => (
                    <tr key={party.id || party.phone || party.name}>
                      <td style={{ cursor: "pointer" }} onClick={() => setSelected(party)}>
                        <div style={{ fontWeight: 700 }}>{party.name}</div>
                        <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>{party.party_category || party.party_type || "customer"}</div>
                      </td>
                      <td>{party.phone || "-"}</td>
                      <td>{party.gstin || "-"}</td>
                      <td>{party.state || "-"}</td>
                      <td>{fmtCur(party.opening_balance ?? party.openingBalance ?? 0)}</td>
                      <td><button className="btn btn-sm btn-ghost" onClick={() => openEdit(party)}>Edit</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selected ? (
          <div className="card">
            <div className="flex justify-between mb-3">
              <div className="card-title" style={{ marginBottom: 0 }}>{selected.name}</div>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: ".86rem", marginBottom: 16 }}>
              <div><strong>Phone:</strong> {selected.phone || "-"}</div>
              <div><strong>Email:</strong> {selected.email || "-"}</div>
              <div><strong>GSTIN:</strong> {selected.gstin || "-"}</div>
              <div><strong>PAN:</strong> {selected.pan_number || selected.panNumber || "-"}</div>
              <div><strong>State:</strong> {selected.state || "-"}</div>
              <div><strong>Billing Address:</strong> {selected.billing_address || selected.billingAddress || "-"}</div>
              <div><strong>Shipping Address:</strong> {selected.shipping_address || selected.shippingAddress || "-"}</div>
              <div><strong>Credit Period:</strong> {selected.credit_period_days ?? selected.creditPeriodDays ?? 0} days</div>
              <div><strong>Credit Limit:</strong> {fmtCur(selected.credit_limit ?? selected.creditLimit ?? 0)}</div>
            </div>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Bill History</div>
            {selectedBills.length === 0 ? (
              <div style={{ color: "var(--text3)", fontSize: ".85rem" }}>No bills yet for this party.</div>
            ) : (
              selectedBills.map((b) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--border)", fontSize: ".82rem" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.id}</div>
                    <div style={{ color: "var(--text3)" }}>{b.desc || "-"} · {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN") : ""}</div>
                  </div>
                  <div className="font-mono">{fmtCur(b.total)}</div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      {showModal ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <div className="modal-title">{editing ? "Edit Party" : "Create Party"}</div>
            <div className="form-grid">
              <div className="form-group">
                <label>Party Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Opening Balance</label>
                <input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
              </div>
              <div className="form-group">
                <label>GSTIN</label>
                <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="29XXXXX9438X1XX" />
              </div>
              <div className="form-group">
                <label>PAN Number</label>
                <input value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} />
              </div>
              <div className="form-group">
                <label>Party Type</label>
                <select value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value })}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                </select>
              </div>
              <div className="form-group">
                <label>Party Category</label>
                <input value={form.partyCategory} onChange={(e) => setForm({ ...form, partyCategory: e.target.value })} placeholder="Retail / Wholesale / School" />
              </div>
              <div className="form-group full">
                <label>Billing Address</label>
                <textarea rows={3} value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Shipping Address</label>
                <textarea rows={3} value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} />
              </div>
              <div className="form-group">
                <label>State</label>
                <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Rajasthan" />
              </div>
              <div className="form-group">
                <label>Balance Type</label>
                <select value={form.balanceType} onChange={(e) => setForm({ ...form, balanceType: e.target.value })}>
                  <option value="to_collect">To Collect</option>
                  <option value="to_pay">To Pay</option>
                </select>
              </div>
              <div className="form-group">
                <label>Credit Period (days)</label>
                <input type="number" value={form.creditPeriodDays} onChange={(e) => setForm({ ...form, creditPeriodDays: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Credit Limit</label>
                <input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contact Person</label>
                <input value={form.contactPersonName} onChange={(e) => setForm({ ...form, contactPersonName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
