import { useMemo, useState } from "react";
import { db } from "./supabase.js";

const defaultLineItem = () => ({ productId: "", qty: 1, rate: 0, taxRate: 0 });
const fmtCur = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowIso = () => new Date().toISOString();
const formatPartyOption = (party) => `${party.name || ""}${party.phone ? ` • ${party.phone}` : ""}`;
const formatProductOption = (product) => `${product.name || ""}${product.unit ? ` • ${product.unit}` : ""}`;
const genInvId = (brand) => {
  const n = Number(brand?.invoiceCounter || 1);
  return `${brand?.prefix || "INV"}-${String(n).padStart(4, "0")}`;
};

const getBillPaymentInfo = (bill, billPayments) => {
  const payments = (billPayments || []).filter((p) => (p.billId || p.bill_id) === bill.id);
  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total = Number(bill.total) || 0;
  const remaining = Math.max(0, total - paidAmount);
  return { paidAmount, remaining, isPaid: remaining <= 0 };
};

function PartyQuickCreateModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", gstin: "" });
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Create Party</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Phone Number *</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label>GST Number</label>
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
          </div>
          <div className="form-group full">
            <label>Address</label>
            <textarea rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>Save Party</button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreviewModal({ bill, brand, onClose }) {
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const msg = [
    `*Invoice from ${brand.shopName}*`,
    ``,
    `Party: ${bill.customer}`,
    `Phone: ${bill.phone}`,
    `Invoice No: ${bill.id}`,
    ``,
    ...((bill.items || []).map((item) => `- ${item.desc} | ${item.qty} ${item.unit || ""} x ${fmtCur(item.rate)} = ${fmtCur(item.subtotal)}`)),
    ``,
    `Total: ${fmtCur(bill.total)}`,
    `View Invoice: ${invLink}`,
  ].join("\n");
  const phone = String(bill.phone || "").replace(/\D/g, "");
  const waUrl = phone ? `https://wa.me/${phone.startsWith("91") ? phone : `91${phone}`}?text=${encodeURIComponent(msg)}` : null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title">WhatsApp Invoice Preview</div>
        <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12, background: "#edf7ee", whiteSpace: "pre-wrap", fontSize: ".85rem", lineHeight: 1.6 }}>
          {msg}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {waUrl ? <a className="btn btn-primary" href={waUrl} target="_blank" rel="noreferrer">Send on WhatsApp</a> : null}
        </div>
      </div>
    </div>
  );
}

export default function SimpleBillingPage({
  bills,
  setBills,
  billPayments,
  showToast,
  customers,
  setCustomers,
  brand,
  setBrand,
  user,
  products,
}) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPartyCreate, setShowPartyCreate] = useState(false);
  const [waPreview, setWaPreview] = useState(null);
  const [confirmDeleteBill, setConfirmDeleteBill] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [invoiceType, setInvoiceType] = useState("supply");
  const [items, setItems] = useState([defaultLineItem()]);
  const [productQueries, setProductQueries] = useState({});
  const [notes, setNotes] = useState("");

  const filteredBills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills || [];
    return (bills || []).filter((b) =>
      [b.id, b.customer, b.phone, b.desc]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [bills, search]);

  const selectedParty = useMemo(() => {
    return (customers || []).find((c) => String(c.id || c.phone || c.name) === selectedPartyId) || null;
  }, [customers, selectedPartyId]);

  const lineRows = items.map((line) => {
    const product = (products || []).find((p) => p.id === line.productId);
    const qty = Number(line.qty) || 1;
    const rate = Number(line.rate) || 0;
    const subtotal = qty * rate;
    const taxRate = invoiceType === "tax" ? Number(line.taxRate ?? product?.tax_rate ?? product?.taxRate ?? 0) : 0;
    const taxAmount = subtotal * (taxRate / 100);
    const amount = subtotal + taxAmount;
    return { ...line, product, qty, rate, subtotal, taxRate, taxAmount, amount };
  });
  const subtotal = lineRows.reduce((s, row) => s + row.subtotal, 0);
  const taxTotal = lineRows.reduce((s, row) => s + row.taxAmount, 0);
  const total = subtotal + taxTotal;

  const addLine = () => setItems((prev) => [...prev, defaultLineItem()]);
  const updateLine = (idx, patch) => setItems((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  const removeLine = (idx) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSelectProduct = (idx, productId) => {
    const product = (products || []).find((p) => p.id === productId);
    updateLine(idx, {
      productId,
      rate: product ? Number(product.default_rate ?? product.defaultRate ?? 0) : 0,
      taxRate: product ? Number(product.tax_rate ?? product.taxRate ?? 0) : 0,
    });
    setProductQueries((prev) => ({ ...prev, [idx]: product ? formatProductOption(product) : "" }));
  };

  const handlePartySelect = (party) => {
    setSelectedPartyId(String(party.id || party.phone || party.name));
    setPartyQuery(formatPartyOption(party));
    setInvoiceType(party.gstin ? "tax" : "supply");
  };

  const handlePartyInputChange = (value) => {
    setPartyQuery(value);
    const match = (customers || []).find((c) => formatPartyOption(c) === value);
    if (match) {
      handlePartySelect(match);
      return;
    }
    if (!value.trim()) setSelectedPartyId("");
  };

  const handleProductInputChange = (idx, value) => {
    setProductQueries((prev) => ({ ...prev, [idx]: value }));
    const match = (products || []).find((p) => formatProductOption(p) === value);
    if (match) {
      handleSelectProduct(idx, match.id);
      return;
    }
    if (!value.trim()) updateLine(idx, { productId: "", rate: 0 });
  };

  const saveParty = async (partyForm) => {
    const phone = String(partyForm.phone || "").replace(/\D/g, "");
    if (!partyForm.name.trim() || !phone) {
      showToast("Party name and phone are required", "error");
      return;
    }
    const payload = {
      name: partyForm.name.trim(),
      phone,
      email: partyForm.email.trim() || null,
      billingAddress: partyForm.address.trim() || null,
      gstin: partyForm.gstin.trim().toUpperCase() || null,
      organisationId: user?.organisationId,
    };
    await db.addCustomer(payload);
    const localParty = { id: phone, ...payload };
    setCustomers((prev) => [localParty, ...prev.filter((c) => String(c.phone || "").replace(/\D/g, "") !== phone)]);
    handlePartySelect(localParty);
    setShowPartyCreate(false);
    showToast("Party saved");
  };

  const createBill = async () => {
    if (!selectedParty) {
      showToast("Select or create a party first", "error");
      return;
    }
    const validItems = lineRows.filter((row) => row.product);
    if (validItems.length === 0) {
      showToast("Add at least one product", "error");
      return;
    }
    const id = genInvId(brand);
    const bill = {
      id,
      customer: selectedParty.name,
      phone: selectedParty.phone,
      email: selectedParty.email || null,
      customerAddress: selectedParty.billing_address || selectedParty.billingAddress || null,
      customerGstin: selectedParty.gstin || null,
      placeOfSupply: selectedParty.state || brand.state || null,
      invoiceType,
      gst: invoiceType === "tax",
      desc: validItems.map((row) => row.product.name).join(", "),
      size: validItems[0]?.product?.size || null,
      qty: validItems.reduce((s, row) => s + row.qty, 0),
      rate: validItems[0]?.rate || 0,
      subtotal,
      gstAmt: taxTotal,
      total,
      paid: false,
      createdAt: nowIso(),
      notes: notes.trim() || null,
      items: validItems.map((row) => ({
        desc: row.product.name,
        qty: row.qty,
        rate: row.rate,
        subtotal: row.subtotal,
        taxRate: row.taxRate,
        taxAmount: row.taxAmount,
        unit: row.product.unit || "",
        hsnSac: row.product.hsn_code || row.product.hsnCode || "",
        size: row.product.size || "",
      })),
      organisationId: user?.organisationId,
    };
    const saved = await db.addBill(bill);
    const finalBill = saved || bill;
    setBills((prev) => [finalBill, ...prev]);
    setBrand((prev) => ({ ...prev, invoiceCounter: Number(prev.invoiceCounter || 1) + 1 }));
    setShowCreate(false);
    setSelectedPartyId("");
    setPartyQuery("");
    setInvoiceType("supply");
    setItems([defaultLineItem()]);
    setProductQueries({});
    setNotes("");
    setWaPreview(finalBill);
    showToast(`Bill created: ${id}`);
  };

  const deleteBill = async (billId) => {
    await db.deleteBill(billId);
    setBills((prev) => prev.filter((b) => b.id !== billId));
    if (waPreview?.id === billId) setWaPreview(null);
    setConfirmDeleteBill(null);
    showToast("Bill deleted");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ width: 280 }}>
          <input placeholder="Search bills..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setInvoiceType("supply"); setPartyQuery(""); setProductQueries({}); setNotes(""); }}>New Bill</button>
      </div>

      <div className="card">
        <div className="card-title">Bills</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Party</th>
                <th>Items</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>
                    No bills yet. Create your first bill with Party + Products only.
                  </td>
                </tr>
              ) : (
                filteredBills.map((bill) => {
                  const payInfo = getBillPaymentInfo(bill, billPayments);
                  return (
                    <tr key={bill.id}>
                      <td>{bill.id}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{bill.customer}</div>
                        <div style={{ fontSize: ".74rem", color: "var(--text3)" }}>{bill.phone || ""}</div>
                      </td>
                      <td>{(bill.items || []).length || 1}</td>
                      <td className="font-mono">{fmtCur(bill.total)}</td>
                      <td className="font-mono">{fmtCur(payInfo.paidAmount)}</td>
                      <td className="font-mono">{fmtCur(payInfo.remaining)}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-sm btn-ghost" onClick={() => window.open(`?inv=${bill.id}`, "_blank")}>Invoice</button>
                          <button className="btn btn-sm btn-primary" onClick={() => setWaPreview(bill)}>WhatsApp</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteBill(bill)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <div className="modal-title">Create Bill</div>
            <div style={{ display: "grid", gap: 18 }}>
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800 }}>1. Party</div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setShowPartyCreate(true)}>Create Party</button>
                </div>
                <input
                  list="party-options"
                  value={partyQuery}
                  onChange={(e) => handlePartyInputChange(e.target.value)}
                  placeholder="Search party by name or phone"
                />
                <datalist id="party-options">
                  {(customers || []).map((c) => (
                    <option key={String(c.id || c.phone || c.name)} value={formatPartyOption(c)} />
                  ))}
                </datalist>
                {selectedParty ? (
                  <div style={{ marginTop: 10, fontSize: ".82rem", color: "var(--text2)" }}>
                    {selectedParty.phone} {selectedParty.gstin ? `• GST ${selectedParty.gstin}` : ""} {selectedParty.billing_address || selectedParty.billingAddress ? `• ${selectedParty.billing_address || selectedParty.billingAddress}` : ""}
                  </div>
                ) : null}
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Invoice Type</div>
                <div className="segmented" style={{ maxWidth: 360 }}>
                  <button
                    type="button"
                    className={`segmented-btn ${invoiceType === "supply" ? "active" : ""}`}
                    onClick={() => setInvoiceType("supply")}
                  >
                    Bill of Supply
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${invoiceType === "tax" ? "active" : ""}`}
                    onClick={() => setInvoiceType("tax")}
                  >
                    Tax Invoice (GST)
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: ".78rem", color: "var(--text3)" }}>
                  Default follows party GST number, but you can change it here before saving the bill.
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ fontWeight: 800 }}>2. Items</div>
                  <button className="btn btn-sm btn-ghost" onClick={addLine}>Add Product</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        {invoiceType === "tax" ? <th>HSN</th> : null}
                        <th>Quantity</th>
                        <th>Price</th>
                        {invoiceType === "tax" ? <th>Tax</th> : null}
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineRows.map((row, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              list={`product-options-${idx}`}
                              value={productQueries[idx] ?? (row.product ? formatProductOption(row.product) : "")}
                              onChange={(e) => handleProductInputChange(idx, e.target.value)}
                              placeholder="Search product"
                            />
                            <datalist id={`product-options-${idx}`}>
                              {(products || []).filter((p) => p.active !== false).map((p) => (
                                <option key={p.id} value={formatProductOption(p)} />
                              ))}
                            </datalist>
                          </td>
                          {invoiceType === "tax" ? <td>{row.product?.hsn_code || row.product?.hsnCode || "-"}</td> : null}
                          <td><input type="number" min={1} value={row.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} /></td>
                          <td><input type="number" min={0} step="0.01" value={row.rate} onChange={(e) => updateLine(idx, { rate: e.target.value })} /></td>
                          {invoiceType === "tax" ? (
                            <td>
                              <div style={{ display: "grid", gap: 6 }}>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.taxRate}
                                  onChange={(e) => updateLine(idx, { taxRate: e.target.value })}
                                  style={{ width: 90 }}
                                />
                                <div className="font-mono" style={{ fontSize: ".78rem" }}>{fmtCur(row.taxAmount)}</div>
                              </div>
                            </td>
                          ) : null}
                          <td className="font-mono">{fmtCur(row.amount)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => removeLine(idx)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Notes (optional)</div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add delivery note, extra instructions, or invoice note"
                />
              </div>

              <div className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
                <div>
                  <div style={{ fontSize: ".8rem", color: "var(--text3)" }}>Simple workflow: Party to Products to Quantity to Save</div>
                  <div style={{ fontSize: ".75rem", color: "var(--text3)", marginTop: 4 }}>Email is optional. WhatsApp uses party phone.</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 230 }}>
                  <div style={{ display: "grid", gap: 8, fontSize: ".84rem", color: "var(--text2)", marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><span>Taxable Amount</span><strong>{fmtCur(subtotal)}</strong></div>
                    {invoiceType === "tax" ? <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><span>SGST @9%</span><strong>{fmtCur(taxTotal / 2)}</strong></div> : null}
                    {invoiceType === "tax" ? <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><span>CGST @9%</span><strong>{fmtCur(taxTotal / 2)}</strong></div> : null}
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--text3)" }}>Total Amount</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>{fmtCur(total)}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createBill}>Generate Bill</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPartyCreate ? <PartyQuickCreateModal onClose={() => setShowPartyCreate(false)} onSave={saveParty} /> : null}
      {waPreview ? <WhatsAppPreviewModal bill={waPreview} brand={brand} onClose={() => setWaPreview(null)} /> : null}
      {confirmDeleteBill ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirmDeleteBill(null)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-title">Delete Bill?</div>
            <div style={{ color: "var(--text2)", lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>{confirmDeleteBill.id}</strong> for <strong>{confirmDeleteBill.customer}</strong>?
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteBill(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteBill(confirmDeleteBill.id)}>Delete</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
