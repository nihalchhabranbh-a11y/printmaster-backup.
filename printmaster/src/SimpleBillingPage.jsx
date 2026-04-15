import { useMemo, useState, useEffect } from "react";
import { roundCurrency } from "./lib/money.js";
import { db } from "./supabase.js";
import { getBillPaymentInfo } from "./billingUtils.js";
import { AddPaymentModal } from "./App.jsx";
import PaywallModal from "./PaywallModal.jsx";

const defaultLineItem = () => ({ productId: "", qty: 1, rate: 0, taxRate: 0, description: "" });
const fmtCur = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowIso = () => new Date().toISOString();
const formatPartyOption = (party) => `${party.name || ""}${party.phone ? ` • ${party.phone}` : ""}`;
const formatProductOption = (product) => `${product.name || ""}${product.unit ? ` • ${product.unit}` : ""}`;
const genInvId = (brand) => {
  const n = Number(brand?.invoiceCounter || 1);
  return `${brand?.prefix || "INV"}-${String(n).padStart(4, "0")}`;
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
    ...((bill.items || []).map((item) => `- ${item.name || item.desc || "Item"}${item.description || item.size ? ` (${item.description || item.size})` : ""} | ${item.qty} ${item.unit || "PCs"} x ${fmtCur(item.rate)} = ${fmtCur(item.amount || item.subtotal || 0)}`)),
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
  setBillPayments,
  showToast,
  customers,
  setCustomers,
  brand,
  setBrand,
  user,
  products,
  initialDraft,
  setInitialDraft,
  onViewInvoice,
  setAdvancedDraft,
}) {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showPartyCreate, setShowPartyCreate] = useState(false);
  const [waPreview, setWaPreview] = useState(null);
  const [confirmDeleteBill, setConfirmDeleteBill] = useState(null);
  const [addPaymentBill, setAddPaymentBill] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [partyQuery, setPartyQuery] = useState("");
  const [invoiceType, setInvoiceType] = useState("supply");
  const [items, setItems] = useState([defaultLineItem()]);
  const [notes, setNotes] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceMethod, setAdvanceMethod] = useState("cash");
  const [editingBillId, setEditingBillId] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState("");
  const [isSaving, setIsSaving] = useState(false); // Task 3.1 – double-submit guard

  // ── Allocate "Payment In" bills to invoices (FIFO) so Paid column is correct ──
  // This handles both old data (no bill_payments) and new data (has bill_payments).
  const paymentInBonus = useMemo(() => {
    const bonus = {};
    const payInByCustomer = {};
    (bills || []).forEach(b => {
      const dt = b.docType || b.doc_type || "";
      if (dt !== "Payment In") return;
      if (!b.customer) return;
      payInByCustomer[b.customer] = (payInByCustomer[b.customer] || 0) + (Number(b.total) || 0);
    });
    Object.entries(payInByCustomer).forEach(([customer, totalPayIn]) => {
      const invoices = (bills || [])
        .filter(b => {
          const dt = b.docType || b.doc_type || "";
          // Exclude payment/return types — everything else is a receivable invoice
          const isPaymentType = dt === "Payment In" || dt === "Sales Return" || dt === "Credit Note";
          return !isPaymentType && b.customer === customer && !b.deleted;
        })
        .sort((a, b) => new Date(a.createdAt || a.created_at || 0) - new Date(b.createdAt || b.created_at || 0));
      // Deduct amounts already tracked via bill_payments (created by new fix)
      const alreadyLinked = (billPayments || []).reduce((sum, p) => {
        const inv = invoices.find(b => b.id === (p.bill_id || p.billId));
        return inv ? sum + (Number(p.amount) || 0) : sum;
      }, 0);
      let netAvail = Math.max(0, totalPayIn - alreadyLinked);
      for (const inv of invoices) {
        if (netAvail <= 0) break;
        const directPaid = (billPayments || [])
          .filter(p => (p.bill_id || p.billId) === inv.id)
          .reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const stillNeeded = Math.max(0, (Number(inv.total) || 0) - directPaid);
        if (stillNeeded <= 0) continue;
        const allocate = Math.min(netAvail, stillNeeded);
        bonus[inv.id] = (bonus[inv.id] || 0) + allocate;
        netAvail -= allocate;
      }
    });
    return bonus;
  }, [bills, billPayments]);


  // Top entry form (Legacy Desktop Layout)
  const [entryForm, setEntryForm] = useState(defaultLineItem());
  const [entryQuery, setEntryQuery] = useState("");

  // SQFT Calculator state
  const [sqftModal, setSqftModal] = useState(null); // { idx: number }
  const [sqftW, setSqftW] = useState("");
  const [sqftH, setSqftH] = useState("");
  // Per-row product search queries for the inline items table
  const [productQueries, setProductQueries] = useState({});

  // Populate from initial draft
  useEffect(() => {
    if (initialDraft) {
      setShowCreate(true);
      
      let match = null;
      if (initialDraft.phone) {
        match = (customers || []).find((c) => String(c.phone || "").replace(/\D/g, "") === String(initialDraft.phone || "").replace(/\D/g, ""));
      }
      if (!match) {
        match = (customers || []).find((c) => String(c.name).toLowerCase() === String(initialDraft.customer || "").toLowerCase());
      }
      
      if (match) {
        setSelectedPartyId(String(match.id || match.phone || match.name));
        setPartyQuery(formatPartyOption(match));
        setInvoiceType(initialDraft.docType || (match.gstin ? "tax" : "supply"));
      } else {
        setPartyQuery(initialDraft.customer || "");
        setSelectedPartyId("");
        if (initialDraft.docType) setInvoiceType(initialDraft.docType);
      }

      if (initialDraft.items && initialDraft.items.length > 0) {
        const newItems = initialDraft.items.map((it) => ({
          productId: it.productId || "",
          nameText: !it.productId ? (it.name || "") : "",
          qty: it.qty || 1,
          rate: it.rate || 0,
          taxRate: it.taxRate || 0,
          description: it.description || ""
        }));
        setItems(newItems);
      }
      
      if (setInitialDraft) setInitialDraft(null);
    }
  }, [initialDraft, customers, products, setInitialDraft]);

  const limitReached = useMemo(() => {
    if (user?.organisationPlan && user.organisationPlan !== "free") return false;
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todaysBills = (bills || []).filter(b => {
      const d = b.createdAt || b.created_at;
      return d ? new Date(d) >= todayStart : false;
    });
    return todaysBills.length >= 11;
  }, [bills, user]);

  const handleNewBillClick = () => {
    if (limitReached) {
      setPaywallFeature("Unlimited daily invoices");
      setShowPaywall(true);
      return;
    }
    setEditingBillId(null); 
    setShowCreate(true); 
    setInvoiceType("supply"); 
    setPartyQuery(""); 
    setNotes(""); 
    setItems([defaultLineItem()]);
  };

  // Check if the bill form has any data the user would lose
  const hasUnsavedChanges = () => {
    const hasParty = !!selectedPartyId || !!partyQuery.trim();
    const hasItems = lineRows.some(r => r.productId || r.nameText || r.description || r.qty > 1 || r.rate > 0);
    const hasAdvance = Number(advanceAmount) > 0;
    const hasNotes = !!notes.trim();
    return hasParty || hasItems || hasAdvance || hasNotes;
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges()) {
      setConfirmLeave(true);
    } else {
      doCloseForm();
    }
  };

  const doCloseForm = () => {
    setShowCreate(false);
    setEditingBillId(null);
    setConfirmLeave(false);
  };

  const openSqft = (idx) => { setSqftModal({ idx }); setSqftW(""); setSqftH(""); };
  const applySqft = () => {
    if (!sqftModal) return;
    const w = parseFloat(sqftW) || 0;
    const h = parseFloat(sqftH) || 0;
    const sqft = parseFloat((w * h).toFixed(2));
    if (sqft > 0) {
      if (sqftModal.idx === 'entry') {
        setEntryForm((prev) => ({ ...prev, qty: sqft, description: `${w}x${h}` }));
      } else {
        updateLine(sqftModal.idx, { qty: sqft, description: `${w}x${h}` });
      }
    }
    setSqftModal(null);
  };

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

  const lineRows = items.map((line, originalIndex) => {
    const product = (products || []).find((p) => p.id === line.productId);
    const qty = Number(line.qty) || 1;
    const rate = Number(line.rate) || 0;
    const subtotal = roundCurrency(qty * rate);
    const taxRate = invoiceType !== "supply" ? Number(line.taxRate ?? product?.tax_rate ?? product?.taxRate ?? 0) : 0;
    const taxAmount = roundCurrency(subtotal * (taxRate / 100));
    const amount = roundCurrency(subtotal + taxAmount);
    return { ...line, product, qty, rate, subtotal, taxRate, taxAmount, amount, originalIndex };
  });
  const subtotal = roundCurrency(lineRows.reduce((s, row) => s + row.subtotal, 0));
  const taxTotal = roundCurrency(lineRows.reduce((s, row) => s + row.taxAmount, 0));
  const total = roundCurrency(subtotal + taxTotal);

  const addLine = () => Object.keys(items[0] || {}).length ? setItems((prev) => [...prev, defaultLineItem()]) : setItems([defaultLineItem()]);
  const handleAddItem = () => {
    if (!entryQuery.trim() && !entryForm.productId) {
      showToast("Please select or enter a product", "error");
      return;
    }
    // Add to items list
    setItems((prev) => {
      // If the only item is empty (just the default row), replace it.
      const isFirstEmpty = prev.length === 1 && !prev[0].productId && !prev[0].description && !prev[0].nameText;
      const list = isFirstEmpty ? [] : prev;
      return [...list, { ...entryForm, nameText: entryQuery }];
    });
    
    // Reset entry form
    setEntryForm(defaultLineItem());
    setEntryQuery("");
  };

  const updateLine = (idx, patch) => setItems((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  const removeLine = (idx) => setItems((prev) => {
    const next = prev.filter((_, i) => i !== idx);
    if (next.length === 0) return [defaultLineItem()]; // Keep at least one empty row to not break things
    return next;
  });

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

  const handleEntryProductChange = (value) => {
    setEntryQuery(value);
    const match = (products || []).find((p) => formatProductOption(p) === value);
    if (match) {
      setEntryForm((prev) => ({
        ...prev,
        productId: match.id,
        rate: Number(match.default_rate ?? match.defaultRate ?? 0),
        taxRate: Number(match.tax_rate ?? match.taxRate ?? 0),
        description: match.description || "",
      }));
    } else if (!value.trim()) {
      setEntryForm((prev) => ({ ...prev, productId: "", rate: 0, description: "" }));
    }
  };

  const handleSelectProduct = (idx, productId) => {
    const match = (products || []).find((p) => p.id === productId);
    if (!match) return;
    updateLine(idx, {
      productId: match.id,
      nameText: match.name || "",
      rate: Number(match.default_rate ?? match.defaultRate ?? 0),
      taxRate: Number(match.tax_rate ?? match.taxRate ?? 0),
      description: match.description || "",
    });
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
    if (isSaving) return; // Task 3.1 – block concurrent submits
    if (!selectedParty) {
      showToast("Select or create a party first", "error");
      return;
    }
    const validItems = lineRows.filter((row) => row.product || row.nameText || row.description || row.qty > 1 || row.rate > 0);
    if (validItems.length === 0) {
      showToast("Add at least one product", "error");
      return;
    }
    const id = editingBillId || genInvId(brand);
    const advanceRaw = Math.max(0, Number(advanceAmount) || 0);
    const safeAdvanceAmount = Math.min(advanceRaw, total);
    const bill = {
      id,
      customer: selectedParty.name,
      phone: selectedParty.phone,
      email: selectedParty.email || null,
      customerAddress: selectedParty.billing_address || selectedParty.billingAddress || null,
      customerGstin: selectedParty.gstin || null,
      placeOfSupply: selectedParty.state || brand.state || null,
      invoiceType,
      gst: invoiceType !== "supply",
      desc: validItems.map((row) => row.nameText || row.product?.name || row.description || "Item").join(", "),
      size: validItems[0]?.product?.size || null,
      qty: Math.ceil(validItems.reduce((s, row) => s + (Number(row.qty) || 0), 0)),
      rate: Number(validItems[0]?.rate) || 0,
      subtotal: Number(subtotal.toFixed(2)),
      gstAmt: Number(taxTotal.toFixed(2)),
      total: Number(total.toFixed(2)),
      paid: safeAdvanceAmount >= total,
      createdAt: nowIso(),
      notes: notes.trim() || null,
      items: validItems.map((row) => ({
        desc: row.nameText || row.product?.name || "Item",
        description: row.description || null,
        qty: row.qty,
        rate: row.rate,
        subtotal: row.subtotal,
        taxRate: row.taxRate,
        taxAmount: row.taxAmount,
        unit: row.product?.unit || "",
        hsnSac: row.product?.hsn_code || row.product?.hsnCode || "",
        size: row.product?.size || "",
      })),
      organisationId: user?.organisationId,
    };
    setIsSaving(true); // Task 3.1
    let saved = null;
    try {
    const saved2 = await db.addBill(bill);
    saved = saved2;
    if (!saved) {
      showToast("Failed to save bill. Does it have too many complex items or invalid data?", "error");
      return; // Stop execution so the modal stays open with the error visible
    }
    const finalBill = saved || bill;
    if (editingBillId) {
      setBills((prev) => prev.map(b => b.id === id ? finalBill : b));
    } else {
      setBills((prev) => [finalBill, ...prev]);
    }
    if (safeAdvanceAmount > 0) {
      const paymentPayload = {
        billId: id,
        organisationId: user?.organisationId,
        method: advanceMethod || "cash",
        amount: safeAdvanceAmount,
        note: "Advance received at bill creation",
      };
      try {
        const savedPayment = await db.addBillPayment(paymentPayload);
        if (setBillPayments) {
          if (savedPayment) {
            setBillPayments((prev) => [savedPayment, ...(prev || [])]);
          } else {
            setBillPayments((prev) => [
              {
                id: `local-pay-${Date.now()}`,
                billId: id,
                organisationId: user?.organisationId,
                method: paymentPayload.method,
                amount: paymentPayload.amount,
                note: paymentPayload.note,
                paidAt: nowIso(),
              },
              ...(prev || []),
            ]);
          }
        }
      } catch (payErr) {
        // Task 3.2: payment failed after bill was saved — show warning so user can record manually
        console.error("Advance payment save failed:", payErr);
        showToast("⚠️ Bill saved, but advance payment could not be recorded. Please add it manually.", "error");
      }
    }
    if (!editingBillId) {
      setBrand((prev) => ({ ...prev, invoiceCounter: Number(prev.invoiceCounter || 1) + 1 }));
    }
    setShowCreate(false);
    setEditingBillId(null);
    setSelectedPartyId("");
    setPartyQuery("");
    setInvoiceType("supply");
    setItems([defaultLineItem()]);
    setNotes("");
    setAdvanceAmount("");
    setAdvanceMethod("cash");
    setWaPreview(finalBill);
    showToast(`Bill ${editingBillId ? "updated" : "created"}: ${id}`);
    } catch (e) {
      // Task 3.2: surface all unhandled bill-creation errors to the user
      console.error("createBill error:", e);
      showToast("Error saving bill: " + (e?.message || "Unknown error"), "error");
    } finally {
      setIsSaving(false); // Task 3.1
    }
  };

  const deleteBill = async (billId) => {
    // Task 3.3 – check DB response BEFORE updating local state to prevent ghost deletes
    const err = await db.deleteBill(billId);
    if (err) {
      showToast("Failed to delete bill: " + (err.message || "Unknown error"), "error");
      setConfirmDeleteBill(null);
      return;
    }
    setBills((prev) => prev.filter((b) => b.id !== billId));
    if (waPreview?.id === billId) setWaPreview(null);
    setConfirmDeleteBill(null);
    showToast("Bill deleted");
  };

  const handleAddPayment = async (billId, method, amount, note) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) {
      showToast("Enter a valid amount", "error");
      return;
    }
    try {
      const saved = await db.addBillPayment({
        billId,
        organisationId: user?.organisationId,
        method: method || "cash",
        amount: amt,
        note: note || null,
      });
      if (saved && setBillPayments) {
        setBillPayments((prev) => [saved, ...(prev || [])]);
      }
      const bill = bills.find((b) => b.id === billId);
      if (bill) {
        const paymentsForBill = (saved ? [saved] : []).concat(billPayments || []);
        const info = getBillPaymentInfo(bill, paymentsForBill);
        if (info.isPaid) {
          setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, paid: true } : b)));
          try {
            await db.updateBillPaid(billId, true);
          } catch {
            // ignore
          }
        }
      }
      showToast("Payment recorded");
    } catch (err) {
      console.error("Failed to add payment from SimpleBillingPage", err);
      showToast("Failed to record payment", "error");
    } finally {
      setAddPaymentBill(null);
    }
  };

  const handleEditBill = (bill) => {
    // If it has advanced fields, or is a non-standard document, open in advanced builder
    const hasAdvancedFields = bill.isAdvanced || bill.shippingAddress || bill.terms || bill.bankDetails;
    const isNonClassicDoc = bill.docType && !["Tax Invoice (GST)", "Bill of Supply", "", undefined, "tax", "supply"].includes(bill.docType);

    if (setAdvancedDraft && (hasAdvancedFields || isNonClassicDoc)) {
       showToast("Opening in Advanced Builder...", "info");
       setAdvancedDraft(bill);
       return;
    }

    setEditingBillId(bill.id);
    const party = (customers || []).find(c => String(c.id || c.phone || c.name) === String(bill.customer_id || bill.phone || bill.customer)) || {
       id: bill.phone, name: bill.customer, phone: bill.phone, email: bill.email, gstin: bill.customerGstin 
    };
    handlePartySelect(party);

    if (bill.items && bill.items.length > 0) {
      const loadedItems = bill.items.map(it => ({
         productId: it.productId || "",
         nameText: it.nameText || it.name || it.desc || "",
         description: it.description || it.desc || "",
         qty: it.qty || 1,
         rate: it.rate || 0,
         taxRate: it.taxRate || 0,
         taxAmount: it.taxAmount || 0,
         subtotal: it.subtotal || 0
      }));
      setItems(loadedItems);
    } else {
      setItems([defaultLineItem()]);
    }
    setNotes(bill.notes || "");
    setAdvanceAmount(""); 
    setShowCreate(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ width: 280 }}>
          <input placeholder="Search bills..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={handleNewBillClick}>New Bill</button>
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
                  const bonus = paymentInBonus[bill.id] || 0;
                  const totalPaid = Math.min(Number(bill.total) || 0, payInfo.paidAmount + bonus);
                  const totalRemaining = Math.max(0, (Number(bill.total) || 0) - totalPaid);
                  const isFullyPaid = totalPaid >= (Number(bill.total) || 0);
                  const isPaymentIn = bill.docType === "Payment In" || bill.doc_type === "Payment In";

                  if (isPaymentIn) {
                    const billDate = new Date(bill.createdAt || new Date());
                    const isRecent = (new Date() - billDate) < 24 * 60 * 60 * 1000;

                    return (
                      <tr key={bill.id} style={{ background: "rgba(34, 197, 94, 0.05)", borderBottom: "1px solid rgba(34, 197, 94, 0.2)" }}>
                        <td colSpan={7} style={{ padding: "0" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(34, 197, 94, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#166534", position: "relative" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokelinejoin="round" style={{ zIndex: 1 }}><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                {isRecent && (
                                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(34, 197, 94, 0.3)", animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}></div>
                                )}
                              </div>
                              <div>
                                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>Payment Received</div>
                                <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>from <span style={{ fontWeight: 600 }}>{bill.customer}</span> {bill.phone ? `(${bill.phone})` : ""}</div>
                              </div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
                              <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <div style={{ fontFamily: "var(--mono)", fontSize: "1.05rem", fontWeight: 800, color: "#16a34a" }}>+{fmtCur(bill.total)}</div>
                                <div style={{ fontSize: "0.65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, marginTop: "2px" }}>{new Date(bill.createdAt || new Date()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                              </div>
                              <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                                <button className="btn btn-sm btn-ghost" onClick={() => typeof onViewInvoice === "function" && onViewInvoice(bill.id)}>Receipt</button>
                                <button className="btn btn-sm btn-primary" onClick={() => setWaPreview(bill)}>WhatsApp</button>
                                <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteBill(bill)}>Delete</button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={bill.id}>
                      <td>{bill.id}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{bill.customer}</div>
                        <div style={{ fontSize: ".74rem", color: "var(--text3)" }}>{bill.phone || ""}</div>
                      </td>
                      <td>{(bill.items || []).length || 1}</td>
                      <td className="font-mono">{fmtCur(bill.total)}</td>
                      <td className="font-mono" style={{ color: totalPaid > 0 ? "#16a34a" : undefined, fontWeight: totalPaid > 0 ? 600 : undefined }}>{fmtCur(totalPaid)}</td>
                      <td className="font-mono" style={{ color: totalRemaining > 0 ? "#dc2626" : undefined }}>{fmtCur(totalRemaining)}</td>
                      <td>
                        <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                          <button className="btn btn-sm btn-ghost" onClick={() => handleEditBill(bill)}>Edit</button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => setAddPaymentBill(bill)}
                          >
                            Payment
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => typeof onViewInvoice === "function" && onViewInvoice(bill.id)}>Invoice</button>
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
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) handleCloseAttempt();
        }}>
          <div className="modal" style={{ maxWidth: 1100 }}>
            <div className="modal-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                 {editingBillId ? "Edit Bill" : "Create Bill"}
                 {editingBillId && <span style={{ fontSize: "0.9rem", color: "var(--text3)", fontWeight: 500 }}>#{editingBillId}</span>}
              </div>
              <button className="btn btn-sm btn-ghost" onClick={handleCloseAttempt} style={{ padding: "4px 8px" }}>✕</button>
            </div>
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
                <div style={{ fontWeight: 800, marginBottom: 12 }}>Document Type</div>
                <div style={{ maxWidth: 360 }}>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value)}
                    className="app-input"
                    style={{ width: "100%" }}
                  >
                    <option value="tax">Tax Invoice (GST)</option>
                    <option value="supply">Bill of Supply (Non-GST)</option>
                    <option value="Quotation">Quotation / Estimate</option>
                    <option value="Proforma Invoice">Proforma Invoice</option>
                    <option value="Delivery Challan">Delivery Challan</option>
                    <option value="Credit Note">Credit Note</option>
                    <option value="Sales Return">Sales Return</option>
                  </select>
                </div>
                <div style={{ marginTop: 8, fontSize: ".78rem", color: "var(--text3)" }}>
                  Default follows party GST number, but you can change it here before saving the bill.
                </div>
              </div>

              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, marginBottom: 12 }}>2. Items</div>
                
                {/* TOP ENTRY ROW */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Product/Description</div>
                    <input
                      list="entry-product-options"
                      value={entryQuery}
                      onChange={(e) => handleEntryProductChange(e.target.value)}
                      placeholder="Search product"
                      style={{ width: "100%", marginBottom: 4 }}
                    />
                    <datalist id="entry-product-options">
                      {(products || []).filter((p) => p.active !== false).map((p) => (
                        <option key={p.id} value={formatProductOption(p)} />
                      ))}
                    </datalist>
                    <input
                      type="text"
                      value={entryForm.description || ""}
                      onChange={(e) => setEntryForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description (optional)..."
                      style={{ fontSize: ".76rem", width: "100%", padding: "6px 8px" }}
                    />
                  </div>
                  
                  {invoiceType !== "supply" && (
                    <div style={{ width: 80 }}>
                       <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>HSN/SAC</div>
                       <input type="text" placeholder="-" value={entryForm.productId ? ((products || []).find(p => p.id === entryForm.productId)?.hsn_code || "-") : "-"} disabled style={{ width: "100%" }} />
                    </div>
                  )}

                  <div style={{ width: 90 }}>
                    <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Qty</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <input type="number" min={1} value={entryForm.qty} onChange={(e) => setEntryForm(prev => ({ ...prev, qty: e.target.value }))} style={{ flex: 1, padding: "8px 4px", width: "100%" }} />
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ padding: "0px 4px", fontSize: ".65rem", color: "#ea580c", height: "auto" }}
                        onClick={() => openSqft('entry')}
                      >SQFT</button>
                    </div>
                  </div>

                  <div style={{ width: 80 }}>
                    <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Rate</div>
                    <input type="number" min={0} step="0.01" value={entryForm.rate} onChange={(e) => setEntryForm(prev => ({ ...prev, rate: e.target.value }))} style={{ width: "100%" }} />
                  </div>

                  {invoiceType !== "supply" && (
                    <div style={{ width: 70 }}>
                      <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>GST %</div>
                      <input type="number" min={0} step="0.01" value={entryForm.taxRate} onChange={(e) => setEntryForm(prev => ({ ...prev, taxRate: e.target.value }))} style={{ width: "100%" }} />
                    </div>
                  )}

                  <div style={{ width: 90, alignSelf: "flex-start" }}>
                    <button className="btn btn-primary" style={{ width: "100%", marginTop: 22 }} onClick={handleAddItem}>Add Item</button>
                  </div>
                </div>

                {/* TABLE OF ADDED ITEMS */}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr style={{ background: "var(--bg-layer1)" }}>
                        <th>Desc</th>
                        {invoiceType !== "supply" ? <th>Hsn</th> : null}
                        <th>Qty</th>
                        <th>Rate</th>
                        {invoiceType !== "supply" ? <th>Gst</th> : null}
                        {invoiceType !== "supply" ? <th>Taxable</th> : null}
                        {invoiceType !== "supply" ? <th>Gst_Amount</th> : null}
                        <th>Total</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineRows.filter(r => r.productId || r.nameText || r.description || r.qty > 1 || r.rate > 0).map((row, idx) => (
                        <tr key={row.originalIndex}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.nameText || row.product?.name || "-"}</div>
                            {row.description && <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>{row.description}</div>}
                          </td>
                          {invoiceType !== "supply" ? <td>{row.product?.hsn_code || row.product?.hsnCode || "-"}</td> : null}
                          <td>
                            <input 
                              type="number" min="0" step="any"
                              value={items[row.originalIndex].qty} 
                              onChange={(e) => updateLine(row.originalIndex, {qty: e.target.value})}
                              style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", textAlign: "center", background: "var(--bg-layer2)", color: "var(--text1)" }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" min="0" step="any"
                              value={items[row.originalIndex].rate} 
                              onChange={(e) => updateLine(row.originalIndex, {rate: e.target.value})}
                              style={{ width: "80px", padding: "4px", borderRadius: "4px", border: "1px solid var(--border)", textAlign: "right", background: "var(--bg-layer2)", color: "var(--text1)" }}
                            />
                          </td>
                          {invoiceType !== "supply" ? <td>{row.taxRate}%</td> : null}
                          {invoiceType !== "supply" ? <td>{fmtCur(row.subtotal)}</td> : null}
                          {invoiceType !== "supply" ? <td>{fmtCur(row.taxAmount)}</td> : null}
                          <td className="font-mono" style={{ fontWeight: 600 }}>{fmtCur(row.amount)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={() => removeLine(row.originalIndex)}>Remove</button></td>
                        </tr>
                      ))}
                      {lineRows.filter(r => r.productId || r.nameText || r.description || r.qty > 1 || r.rate > 0).length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>No items added yet. Use the top row to add products.</td>
                        </tr>
                      )}
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
                    {invoiceType !== "supply" && taxTotal > 0
                      ? Object.entries(
                          lineRows.reduce((acc, row) => {
                            if (row.taxRate > 0 && row.taxAmount > 0) {
                              acc[row.taxRate] = roundCurrency((acc[row.taxRate] || 0) + row.taxAmount);
                            }
                            return acc;
                          }, {})
                        ).flatMap(([rate, taxAmt]) => [
                          <div key={`sgst-${rate}`} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                            <span>SGST @{(Number(rate) / 2).toFixed(1)}%</span>
                            <strong>{fmtCur(roundCurrency(taxAmt / 2))}</strong>
                          </div>,
                          <div key={`cgst-${rate}`} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                            <span>CGST @{(Number(rate) / 2).toFixed(1)}%</span>
                            <strong>{fmtCur(roundCurrency(taxAmt / 2))}</strong>
                          </div>,
                        ])
                      : null}
                  </div>
                  <div style={{ marginBottom: 10, fontSize: ".8rem", color: "var(--text3)" }}>
                    <div style={{ marginBottom: 4 }}>Advance received (optional)</div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <select
                        value={advanceMethod}
                        onChange={(e) => setAdvanceMethod(e.target.value)}
                        style={{ fontSize: ".8rem" }}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="bank">Bank</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={advanceAmount}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        placeholder="0.00"
                        style={{ width: 110, textAlign: "right" }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: ".78rem", color: "var(--text3)" }}>Total Amount</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>{fmtCur(total)}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleCloseAttempt}>Cancel</button>
              <button className="btn btn-primary" onClick={createBill} disabled={isSaving} style={isSaving ? { opacity: 0.6, cursor: "not-allowed" } : {}}>{isSaving ? "Saving…" : editingBillId ? "Update Bill" : "Generate Bill"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPartyCreate ? <PartyQuickCreateModal onClose={() => setShowPartyCreate(false)} onSave={saveParty} /> : null}
      {waPreview ? <WhatsAppPreviewModal bill={waPreview} brand={brand} onClose={() => setWaPreview(null)} /> : null}
      {addPaymentBill ? (
        <AddPaymentModal
          bill={addPaymentBill}
          billPayments={billPayments}
          onAdd={(method, amount, note) => handleAddPayment(addPaymentBill.id, method, amount, note)}
          onClose={() => setAddPaymentBill(null)}
        />
      ) : null}
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

      {/* SQFT Calculator Modal */}
      {sqftModal ? (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSqftModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-title">SQFT Calculator</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label>Width (ft)</label>
                <input type="number" value={sqftW} onChange={(e) => setSqftW(e.target.value)} placeholder="0" min="0" step="0.1" autoFocus />
              </div>
              <div className="form-group">
                <label>Height (ft)</label>
                <input type="number" value={sqftH} onChange={(e) => setSqftH(e.target.value)} placeholder="0" min="0" step="0.1" />
              </div>
            </div>
            <div style={{ background: "#FFF7ED", borderRadius: 8, padding: "12px 16px", marginBottom: 20, textAlign: "center", border: "1px solid #FDBA74" }}>
              <strong style={{ color: "#ea580c", fontSize: "1rem" }}>
                Total: {((parseFloat(sqftW) || 0) * (parseFloat(sqftH) || 0)).toFixed(2)} sq ft
              </strong>
              {sqftW && sqftH && <div style={{ fontSize: ".8rem", color: "#6B7280", marginTop: 4 }}>Description will be set to: {parseFloat(sqftW)||0}x{parseFloat(sqftH)||0}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSqftModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={applySqft}>Apply to Qty & Description</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Unsaved Changes Confirmation Dialog */}
      {confirmLeave ? (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-title">Unsaved Changes</div>
            <div style={{ color: "var(--text2)", lineHeight: 1.6, marginBottom: 8 }}>
              You have entered data for a new invoice. If you close this window now, all your changes will be lost.
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmLeave(false)}>Stay Here</button>
              <button className="btn btn-danger" onClick={() => doCloseForm()}>Discard Changes</button>
            </div>
          </div>
        </div>
      ) : null}

      <PaywallModal 
        isOpen={showPaywall} 
        onClose={() => setShowPaywall(false)}
        featureName={paywallFeature}
        requiredPlan="pro"
      />
    </div>
  );
}
