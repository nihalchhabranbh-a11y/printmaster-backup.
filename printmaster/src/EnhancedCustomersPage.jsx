import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { db } from "./supabase.js";
import { getBillPaymentInfo } from "./billingUtils.js";

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

const fmtCur = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// SVG Icons
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
const ChevronDownIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>;
const EditIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
const PrintIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>;

export default function EnhancedCustomersPage({ customers, setCustomers, bills, billPayments = [], showToast, user, setAdvancedDraft, jumpToCustomer, setJumpToCustomer }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("transactions");
  const [txFilter, setTxFilter] = useState("all"); // 'all', 'invoices', 'payments'
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewMode, setViewMode] = useState("split"); // 'split' | 'table'
  const [sortCol, setSortCol] = useState("name"); // 'name' | 'balance'
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'
  const [partyTypeFilter, setPartyTypeFilter] = useState("all"); // 'all' | 'customer' | 'supplier'

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutside = () => setShowDropdown(false);
    window.addEventListener("click", handleOutside);
    return () => window.removeEventListener("click", handleOutside);
  }, []);


  const mergedCustomers = useMemo(() => {
    const fromBills = Object.values(
      (bills || []).reduce((acc, b) => {
        const key = String(b.phone || "").replace(/\D/g, "") || (b.customer || "").trim().toLowerCase();
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
            openingBalance: 0,
            balanceType: "to_collect"
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

  // Auto-jump to customer navigated from Live Alerts 🐒
  useEffect(() => {
    if (!jumpToCustomer || !mergedCustomers.length) return;
    const phone = String(jumpToCustomer.phone || "").replace(/\D/g, "");
    const name  = (jumpToCustomer.name  || "").trim().toLowerCase();
    const match = mergedCustomers.find(c => {
      const cp = String(c.phone || "").replace(/\D/g, "");
      return (phone && cp === phone) || (c.name || "").trim().toLowerCase() === name;
    });
    if (match) {
      setSelected(match);
      setViewMode("split");
      setActiveTab("transactions");
    }
    if (typeof setJumpToCustomer === "function") setJumpToCustomer(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToCustomer, mergedCustomers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = mergedCustomers;
    if (q) {
      result = mergedCustomers.filter((c) =>
        [c.name, c.phone, c.email, c.gstin, c.state]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [mergedCustomers, search]);

  const totalToCollect = useMemo(() => {
    return mergedCustomers.reduce((acc, c) => {
      const partyBills = (bills || []).filter(b => {
        const billPhone = String(b.phone || "").replace(/\D/g, "");
        const partyPhone = String(c.phone || "").replace(/\D/g, "");
        return (partyPhone && billPhone === partyPhone) || ((b.customer || "").toLowerCase() === (c.name || "").toLowerCase());
      });
      const pendingDue = partyBills.reduce((sum, b) => sum + getBillPaymentInfo(b, billPayments).remaining, 0);
      let openingBalance = Number(c.opening_balance ?? c.openingBalance ?? 0);
      let balanceType = c.balance_type || c.balanceType || "to_collect";
      
      let finalDue = pendingDue;
      if (balanceType === "to_collect") finalDue += openingBalance;
      else finalDue -= openingBalance;
      
      return finalDue > 0 ? acc + finalDue : acc;
    }, 0);
  }, [mergedCustomers, bills, billPayments]);

  const totalToPay = useMemo(() => {
    return mergedCustomers.reduce((acc, c) => {
      let openingBalance = Number(c.opening_balance ?? c.openingBalance ?? 0);
      let balanceType = c.balance_type || c.balanceType || "to_collect";
      if (balanceType === "to_pay") {
        acc += openingBalance;
      }
      return acc;
    }, 0);
  }, [mergedCustomers]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  // Task 5.3 – useCallback: stable references prevent child row re-renders
  // when only unrelated state in EnhancedCustomersPage changes.
  const openNew = useCallback(() => {
    resetForm();
    setShowModal(true);
  }, []);

  const openEdit = useCallback((party) => {
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
  }, []);

  const handleDelete = useCallback(async (partyId) => {
    if (!window.confirm("Are you sure you want to delete this party? This action cannot be undone.")) return;
    try {
      if (String(partyId).includes("-")) {
        await db.deleteCustomer(partyId);
        setCustomers((list) => list.filter(c => c.id !== partyId));
        showToast("Party deleted successfully");
        if (selected?.id === partyId) setSelected(null);
      } else {
        showToast("Cannot delete dynamically generated party from bills. Please delete their bills first.", "error");
      }
    } catch (err) {
      showToast(err.message || "Failed to delete party", "error");
    }
  }, [showToast, selected]);

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
        const updated = { ...editing, ...payload };
        setCustomers((list) => list.map((c) => (c.id === editing.id ? updated : c)));
        if(selected?.id === editing.id) setSelected(updated);
      } else {
        const result = await db.addCustomer(payload);
        setCustomers((list) => [{ id: result?.[0]?.id || payload.phone || payload.name, ...payload }, ...list]);
      }
      showToast("Party saved");
      setShowModal(false);
      resetForm();
    } catch (e) {
      showToast(e.message || "Failed to save party", "error");
    }
  };

  const getPartyBalanceDetails = (party) => {
    if (!party) return { finalDue: 0, balanceType: "to_collect" };
    const partyBills = (bills || []).filter(b => {
      const billPhone = String(b.phone || "").replace(/\D/g, "");
      const partyPhone = String(party.phone || "").replace(/\D/g, "");
      return (partyPhone && billPhone === partyPhone) || ((b.customer || "").toLowerCase() === (party.name || "").toLowerCase());
    });
    
    let openingBalance = Number(party.opening_balance ?? party.openingBalance ?? 0);
    let openingType = party.balance_type || party.balanceType || "to_collect";
    
    let pendingDue = partyBills.reduce((sum, b) => {
      const docType = b.docType || b.doc_type || "Sales Invoice";
      if (docType === "Payment In" || docType === "Sales Return" || docType === "Credit Note") {
         return sum - (b.total || 0);
      }
      return sum + getBillPaymentInfo(b, billPayments).remaining;
    }, 0);
    
    let netAmount = pendingDue; 
    // positive = we collect, negative = we pay
    if (openingType === "to_collect") {
      netAmount += openingBalance;
    } else {
      netAmount -= openingBalance;
    }
    
    return {
      finalDue: Math.abs(netAmount),
      balanceType: netAmount >= 0 ? "to_collect" : "to_pay"
    };
  };

  const selectedBills = useMemo(() => {
    if (!selected) return [];
    return (bills || []).filter((b) => {
      const billPhone = String(b.phone || "").replace(/\D/g, "");
      const selectedPhone = String(selected.phone || "").replace(/\D/g, "");
      return (selectedPhone && billPhone === selectedPhone) || ((b.customer || "").toLowerCase() === (selected.name || "").toLowerCase());
    }).sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [selected, bills]);

  const selectedTransactions = useMemo(() => {
    const tx = [];
    selectedBills.forEach(b => {
      const docType = b.docType || b.doc_type || "Sales Invoice";
      const isCreditDoc = ["Payment In", "Credit Note", "Sales Return"].includes(docType);

      tx.push({
        id: "inv-" + b.id,
        date: new Date(b.createdAt || 0),
        type: docType,
        number: b.id,
        amount: b.total || 0,
        status: isCreditDoc ? "Closed" : getBillPaymentInfo(b, billPayments).status,
        isPayment: isCreditDoc,
        source: b
      });
      // Add corresponding payments
      const payments = billPayments.filter(p => p.bill_id === b.id);
      payments.forEach(p => {
        tx.push({
          id: "pay-" + p.id,
          date: new Date(p.created_at || 0),
          type: "Payment In",
          number: p.id.split("-")[0].toUpperCase(),
          amount: p.amount || 0,
          status: "Paid",
          isPayment: true,
          source: p
        });
      });
    });
    
    // Sort transactions by date descending
    tx.sort((a, b) => b.date - a.date);
    
    if (txFilter === "invoices") return tx.filter(t => !t.isPayment);
    if (txFilter === "payments") return tx.filter(t => t.isPayment);
    return tx;
  }, [selectedBills, billPayments, txFilter]);

  const selectedItems = useMemo(() => {
    const itemMap = new Map();
    selectedBills.forEach(bill => {
      let items = [];
      try {
        if (typeof bill.items === "string") {
          items = JSON.parse(bill.items);
        } else if (Array.isArray(bill.items)) {
          items = bill.items;
        }
      } catch(e) {}
      
      items.forEach(it => {
        const name = it.item_name || it.description || it.name || "Unknown Item";
        const qty = Number(it.quantity || it.qty || 1);
        const amount = Number(it.amount || it.total || (qty * Number(it.price || 0)));
        if (itemMap.has(name)) {
          const e = itemMap.get(name);
          e.qty += qty;
          e.amount += amount;
        } else {
          itemMap.set(name, { name, qty, amount });
        }
      });
    });
    return Array.from(itemMap.values()).sort((a,b) => b.amount - a.amount);
  }, [selectedBills]);

  // Handle setting initial selected customer automatically if empty
  // Skip when a jumpToCustomer is pending — it will set the correct one
  useEffect(() => {
    if (!selected && !jumpToCustomer && filtered.length > 0 && viewMode === "split") {
      setSelected(filtered[0]);
    }
  }, [filtered, selected, viewMode, jumpToCustomer]);

  // Task 4.2 – Pre-compute balance for every party once; O(parties×bills) happens
  // here not on every sort comparator or row render.
  const balanceMap = useMemo(() => {
    const map = new Map();
    mergedCustomers.forEach(party => {
      map.set(party.id || party.phone || party.name, getPartyBalanceDetails(party));
    });
    return map;
  }, [mergedCustomers, bills, billPayments]);

  // Helper: look up pre-computed balance - O(1) per call
  const getBalance = useCallback(
    (party) => balanceMap.get(party.id || party.phone || party.name) || { finalDue: 0, balanceType: "to_collect" },
    [balanceMap]
  );

  // Table sorted data
  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortCol === "balance") {
        const aVal = (balanceMap.get(a.id || a.phone || a.name) || { finalDue: 0 }).finalDue;
        const bVal = (balanceMap.get(b.id || b.phone || b.name) || { finalDue: 0 }).finalDue;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      // default: name
      const aName = (a.name || "").toLowerCase();
      const bName = (b.name || "").toLowerCase();
      return sortDir === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
    });
  }, [filtered, sortCol, sortDir, balanceMap]);

  const handleSort = useCallback((col) => { // Task 5.3
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }, [sortCol]); // Task 5.3 – deps: re-create only when sortCol changes

  return (
    <div style={{ height: "calc(100vh - 40px)", display: "flex", flexDirection: "column", background: "#f8f9fa", fontFamily: "system-ui, sans-serif" }}>
      
      {/* Top Global Summary Row */}
      <div style={{ display: "flex", gap: "16px", padding: "16px 24px", background: "white", borderBottom: "1px solid #e5e7eb", alignItems: "center" }}>
        <div style={{ flex: 1, padding: "14px 18px", background: "#f3f4f6", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <div>
            <div style={{ color: "#6b7280", fontSize: "12px", fontWeight: "600" }}>All Parties</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#111827" }}>{mergedCustomers.length}</div>
          </div>
        </div>
        <div style={{ flex: 2, padding: "14px 18px", background: "#ecfdf5", borderRadius: "8px", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M12 2v20"/><path d="m17 5-5-3-5 3"/><path d="m17 19-5 3-5-3"/></svg>
          <div>
            <div style={{ color: "#059669", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "14px" }}>↑</span> To Collect
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#059669" }}>{fmtCur(totalToCollect)}</div>
          </div>
        </div>
        <div style={{ flex: 1, padding: "14px 18px", background: "#fef2f2", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M12 2v20"/><path d="m17 19-5 3-5-3"/><path d="m17 5-5-3-5 3"/></svg>
          <div>
            <div style={{ color: "#dc2626", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "14px" }}>↓</span> To Pay
            </div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#dc2626" }}>{fmtCur(totalToPay)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {/* View toggle */}
          <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: "6px", overflow: "hidden" }}>
            <button
              onClick={() => setViewMode("split")}
              title="Split-pane view"
              style={{ padding: "8px 12px", background: viewMode === "split" ? "#eef2ff" : "white", border: "none", cursor: "pointer", color: viewMode === "split" ? "#4f46e5" : "#6b7280", borderRight: "1px solid #e5e7eb" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              style={{ padding: "8px 12px", background: viewMode === "table" ? "#eef2ff" : "white", border: "none", cursor: "pointer", color: viewMode === "table" ? "#4f46e5" : "#6b7280" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v4H3z"/><path d="M3 11h18v2H3z"/><path d="M3 17h18v4H3z"/></svg>
            </button>
          </div>
          <button
            onClick={openNew}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "#4f46e5", color: "white", padding: "10px 20px", borderRadius: "6px", fontWeight: "600", border: "none", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <PlusIcon /> Create Party
          </button>
        </div>
      </div>

      {/* ── TABLE VIEW ─────────────────────────────────────────────────── */}
      {viewMode === "table" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Table toolbar */}
          <div style={{ padding: "12px 24px", background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
              <div style={{ position: "absolute", left: "10px", top: "10px", color: "#9ca3af" }}><SearchIcon /></div>
              <input
                type="text"
                placeholder="Search Party, Mobile..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "9px 12px 9px 34px", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "14px" }}
              />
            </div>
            {/* Party type filter */}
            {["all", "customer", "supplier"].map(f => (
              <button key={f} onClick={() => setPartyTypeFilter(f)} style={{ padding: "7px 14px", borderRadius: "6px", border: "1px solid", borderColor: partyTypeFilter === f ? "#4f46e5" : "#d1d5db", background: partyTypeFilter === f ? "#eef2ff" : "white", color: partyTypeFilter === f ? "#4f46e5" : "#374151", fontWeight: "600", fontSize: "13px", cursor: "pointer", textTransform: "capitalize" }}>
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div style={{ marginLeft: "auto", fontSize: "13px", color: "#6b7280" }}>{sortedFiltered.length} parties</div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: "600", color: "#374151", cursor: "pointer", userSelect: "none", minWidth: "200px" }}
                    onClick={() => handleSort("name")}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      Party Name
                      <span style={{ opacity: sortCol === "name" ? 1 : 0.4, fontSize: "12px" }}>{sortCol === "name" && sortDir === "asc" ? "↑" : "↓"}</span>
                    </div>
                  </th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: "600", color: "#374151", minWidth: "130px" }}>Category</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: "600", color: "#374151", minWidth: "140px" }}>Mobile Number</th>
                  <th style={{ padding: "12px 20px", textAlign: "left", fontWeight: "600", color: "#374151", minWidth: "120px" }}>Party type</th>
                  <th style={{ padding: "12px 20px", textAlign: "right", fontWeight: "600", color: "#374151", cursor: "pointer", userSelect: "none", minWidth: "140px" }}
                    onClick={() => handleSort("balance")}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                      Balance
                      <span style={{ opacity: sortCol === "balance" ? 1 : 0.4, fontSize: "12px" }}>{sortCol === "balance" && sortDir === "asc" ? "↑" : "↓"}</span>
                    </div>
                  </th>
                  <th style={{ width: "48px" }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedFiltered
                  .filter(p => partyTypeFilter === "all" || (p.party_type || p.partyType || "customer").toLowerCase() === partyTypeFilter)
                  .map((party, idx) => {
                    const balInfo = getBalance(party); // Task 4.2 – O(1) map lookup
                    const isCredit = balInfo.finalDue > 0 && balInfo.balanceType === "to_collect";
                    const isDebit = balInfo.finalDue > 0 && balInfo.balanceType !== "to_collect";
                    return (
                      <tr
                        key={party.id || party.phone || party.name}
                        onClick={() => { setViewMode("split"); setSelected(party); }}
                        style={{ background: idx % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #f3f4f6", cursor: "pointer", transition: "background 0.12s" }}
                        onMouseOver={e => e.currentTarget.style.background = "#eef2ff"}
                        onMouseOut={e => e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa"}
                      >
                        <td style={{ padding: "13px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "13px", flexShrink: 0 }}>
                              {(party.name || "P").charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: "500", color: "#111827" }}>{party.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: "13px 20px", color: "#6b7280" }}>{party.party_category || party.partyCategory || "—"}</td>
                        <td style={{ padding: "13px 20px", color: "#374151" }}>{party.phone || "—"}</td>
                        <td style={{ padding: "13px 20px" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9" }}>
                            {party.party_type || party.partyType || "Customer"}
                          </span>
                        </td>
                        <td style={{ padding: "13px 20px", textAlign: "right" }}>
                          {balInfo.finalDue === 0 ? (
                            <span style={{ color: "#6b7280", fontWeight: "500" }}>₹ 0</span>
                          ) : (
                            <span style={{ color: isCredit ? "#059669" : "#dc2626", fontWeight: "600" }}>
                              {isCredit ? "↓" : "↑"} {fmtCur(balInfo.finalDue)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "13px 12px", textAlign: "center" }}>
                          <button
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "4px", borderRadius: "4px" }}
                            onClick={e => { e.stopPropagation(); setSelected(party); setViewMode("split"); }}
                            title="Open detail"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
            {sortedFiltered.length === 0 && (
              <div style={{ padding: "48px", textAlign: "center", color: "#6b7280" }}>No parties found.</div>
            )}
          </div>
        </div>
      )}

      {/* ── SPLIT-PANE VIEW ─────────────────────────────────────────────── */}
      {viewMode === "split" && (
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar - Parties List */}
        <div style={{ width: "280px", background: "white", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", left: "10px", top: "10px", color: "#9ca3af" }}><SearchIcon /></div>
              <input 
                type="text" 
                placeholder="Search Party" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "8px 12px 8px 36px", border: "1px solid #d1d5db", borderRadius: "6px", outline: "none", fontSize: "14px" }} 
              />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>No parties found.</div>
            ) : (
                filtered.map((party) => {
                  const balInfo = getBalance(party); // Task 4.2 – O(1) map lookup
                  const isSelected = selected?.id === party.id || selected?.name === party.name;
                  return (
                    <div 
                      key={party.id || party.phone || party.name}
                      onClick={() => setSelected(party)}
                      style={{ 
                        padding: "12px 16px", 
                        borderBottom: "1px solid #f3f4f6", 
                        cursor: "pointer",
                        background: isSelected ? "#eef2ff" : "white",
                        borderLeft: isSelected ? "3px solid #4f46e5" : "3px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#e0e7ff", color: "#4f46e5", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "16px", flexShrink: 0 }}>
                        {(party.name || "P").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ fontWeight: "600", color: "#111827", fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{party.name}</div>
                        <div style={{ fontWeight: "500", fontSize: "12px", color: balInfo.balanceType === "to_collect" ? "#059669" : "#dc2626", marginTop: "2px" }}>
                          {fmtCur(balInfo.finalDue)} {balInfo.finalDue > 0 ? (balInfo.balanceType === "to_collect" ? "(Receivable)" : "(Payable)") : ""}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Right Details Panel */}
        {selected ? (
           <div style={{ flex: 1, background: "#f8f9fa", display: "flex", flexDirection: "column", overflow: "hidden" }}>
             
             {/* Header */}
             <div style={{ padding: "20px 24px", background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#111827", marginBottom: "4px" }}>{selected.name}</div>
                  <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", gap: "16px" }}>
                    <span>Phone: {selected.phone || "-"}</span>
                    <span>GSTIN: {selected.gstin || "-"}</span>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ position: "relative" }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setShowDropdown(!showDropdown); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", background: "white", border: "1px solid #d1d5db", color: "#374151", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", fontSize: "14px", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                      Create Sales Invoice
                      <ChevronDownIcon />
                    </button>
                    {showDropdown && (
                      <div style={{ position: "absolute", top: "100%", right: 0, marginTop: "4px", background: "white", border: "1px solid #e5e7eb", borderRadius: "6px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", minWidth: "200px", zIndex: 10 }}>
                        {[
                           { label:"Sales Invoice", type:"Sales Invoice" },
                           { label:"Payment In", type:"Payment In" },
                           { label:"Quotation", type: "Quotation" },
                           { label:"Proforma Invoice", type: "Proforma Invoice" },
                           { label:"Sales Return", type: "Sales Return" },
                           { label:"Delivery Challan", type: "Delivery Challan" },
                           { label:"Purchase Order", type: "Purchase Order" }
                        ].map(item => (
                          <div 
                            key={item.label} 
                            style={{ padding: "10px 16px", fontSize: "14px", color: "#374151", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }} 
                            onClick={() => {
                              setShowDropdown(false);
                              if (typeof setAdvancedDraft === 'function') {
                                setAdvancedDraft({
                                    customer: selected.name,
                                    phone: selected.phone,
                                    docType: item.type
                                });
                              }
                            }}
                          >
                            {item.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => openEdit(selected)} style={{ padding: "8px 12px", border: "1px solid #d1d5db", background: "white", borderRadius: "6px", cursor: "pointer", color: "#4b5563" }} title="Edit Party">
                    <EditIcon />
                  </button>
                  <button onClick={() => handleDelete(selected.id)} style={{ padding: "8px 12px", border: "1px solid #fecaca", background: "#fef2f2", borderRadius: "6px", cursor: "pointer", color: "#ef4444" }} title="Delete Party">
                    <TrashIcon />
                  </button>
                </div>
             </div>

             {/* Tabs & Content Container */}
             <div style={{ padding: "0 24px", background: "white", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "24px" }}>
                {[
                  { id: "transactions", label: "Transactions" },
                  { id: "profile", label: "Profile" },
                  { id: "ledger", label: "Ledger (Statement)" },
                  { id: "items", label: "Item Wise Report" },
                ].map(tab => (
                  <div 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ 
                      padding: "16px 4px",
                      fontSize: "14px",
                      fontWeight: activeTab === tab.id ? "600" : "500",
                      color: activeTab === tab.id ? "#4f46e5" : "#6b7280",
                      borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {tab.label}
                  </div>
                ))}
             </div>

             {/* Tab Content Area */}
             <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
               
               {/* ---------------- TRANSACTIONS TAB ---------------- */}
               {activeTab === "transactions" && (
                 <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                   {/* Tx Filters */}
                   <div style={{ padding: "16px", borderBottom: "1px solid #e5e7eb", display: "flex", gap: "12px", background: "#f9fafb" }}>
                     {["all", "invoices", "payments"].map(f => (
                       <button
                         key={f}
                         onClick={() => setTxFilter(f)}
                         style={{
                           padding: "6px 16px",
                           borderRadius: "100px",
                           fontSize: "13px",
                           fontWeight: "500",
                           background: txFilter === f ? "#eef2ff" : "white",
                           color: txFilter === f ? "#4f46e5" : "#6b7280",
                           border: txFilter === f ? "1px solid #c7d2fe" : "1px solid #d1d5db",
                           cursor: "pointer",
                           textTransform: "capitalize"
                         }}
                       >
                         {f}
                       </button>
                     ))}
                   </div>
                   {/* Tx Table */}
                   <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                     <thead style={{ background: "#f3f4f6", color: "#4b5563" }}>
                       <tr>
                         <th style={{ padding: "12px 16px", fontWeight: "600" }}>Date</th>
                         <th style={{ padding: "12px 16px", fontWeight: "600" }}>Transaction Type</th>
                         <th style={{ padding: "12px 16px", fontWeight: "600" }}>Transaction Number</th>
                         <th style={{ padding: "12px 16px", fontWeight: "600", textAlign: "right" }}>Amount</th>
                         <th style={{ padding: "12px 16px", fontWeight: "600", textAlign: "center" }}>Status</th>
                       </tr>
                     </thead>
                     <tbody>
                       {selectedTransactions.length === 0 ? (
                         <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>No transactions found.</td></tr>
                       ) : (
                         selectedTransactions.map((t, idx) => (
                           <tr key={t.id + idx} style={{ borderTop: "1px solid #e5e7eb", color: t.isPayment ? "#059669" : "#111827", cursor: t.isPayment ? "default" : "pointer" }} onClick={() => { if(!t.isPayment && typeof onViewInvoice === "function") onViewInvoice(t.source.id); }}>
                             <td style={{ padding: "12px 16px" }}>{t.date.toLocaleDateString('en-IN', {day:"2-digit", month:"short", year:"numeric"})}</td>
                             <td style={{ padding: "12px 16px" }}>{t.type}</td>
                             <td style={{ padding: "12px 16px", fontWeight: "500" }}>{t.number}</td>
                             <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600" }}>{fmtCur(t.amount)}</td>
                             <td style={{ padding: "12px 16px", textAlign: "center" }}>
                               <span style={{ 
                                 display: "inline-block", padding: "4px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600",
                                 background: t.status === "Paid" ? "#d1fae5" : t.status === "Unpaid" ? "#fee2e2" : "#fef3c7",
                                 color: t.status === "Paid" ? "#065f46" : t.status === "Unpaid" ? "#991b1b" : "#92400e"
                               }}>
                                 {t.status}
                               </span>
                             </td>
                           </tr>
                         ))
                       )}
                     </tbody>
                   </table>
                 </div>
               )}

               {/* ---------------- PROFILE TAB ---------------- */}
               {activeTab === "profile" && (
                 <div style={{ display: "grid", gap: "24px" }}>
                   {/* Action row */}
                   <div style={{ display: "flex", gap: "12px" }}>
                     <button style={{ flex: 1, padding: "12px", background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", fontWeight: "600", color: "#374151" }}>📞 Call Party</button>
                     <button style={{ flex: 1, padding: "12px", background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", fontWeight: "600", color: "#374151", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.115.548 4.17 1.593 5.986L.048 24l6.136-1.547a11.96 11.96 0 0 0 5.847 1.523h.003c6.645 0 12.03-5.386 12.03-12.031S18.676 0 12.031 0z"/></svg> 
                       WhatsApp Reminder
                     </button>
                     <button style={{ flex: 1, padding: "12px", background: "white", border: "1px solid #e5e7eb", borderRadius: "8px", fontWeight: "600", color: "#374151" }}>📄 Share Statement</button>
                   </div>
                   
                   <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "20px" }}>
                     <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px", color: "#111827", borderBottom: "1px solid #f3f4f6", paddingBottom: "12px" }}>Contact Details</div>
                     <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", fontSize: "14px" }}>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Phone Number</div><div style={{ fontWeight: "500" }}>{selected.phone || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Email Address</div><div style={{ fontWeight: "500" }}>{selected.email || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Billing Address</div><div style={{ fontWeight: "500" }}>{selected.billing_address || selected.billingAddress || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Shipping Address</div><div style={{ fontWeight: "500" }}>{selected.shipping_address || selected.shippingAddress || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>GSTIN</div><div style={{ fontWeight: "500" }}>{selected.gstin || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>PAN Number</div><div style={{ fontWeight: "500" }}>{selected.pan_number || selected.panNumber || "-"}</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Credit Period</div><div style={{ fontWeight: "500" }}>{selected.credit_period_days ?? selected.creditPeriodDays ?? 0} days</div></div>
                       <div><div style={{ color: "#6b7280", marginBottom: "4px" }}>Credit Limit</div><div style={{ fontWeight: "500" }}>{fmtCur(selected.credit_limit ?? selected.creditLimit ?? 0)}</div></div>
                     </div>
                   </div>
                 </div>
               )}

               {/* ---------------- LEDGER TAB ---------------- */}
               {activeTab === "ledger" && (
                 <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827" }}>Running Statement</div>
                      <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", background: "white", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                        <PrintIcon /> Print / PDF
                      </button>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                     <thead style={{ background: "#f3f4f6", color: "#4b5563" }}>
                       <tr>
                         <th style={{ padding: "12px", fontWeight: "600" }}>Date</th>
                         <th style={{ padding: "12px", fontWeight: "600" }}>Particulars</th>
                         <th style={{ padding: "12px", fontWeight: "600", textAlign: "right" }}>Debit (-)</th>
                         <th style={{ padding: "12px", fontWeight: "600", textAlign: "right" }}>Credit (+)</th>
                         <th style={{ padding: "12px", fontWeight: "600", textAlign: "right" }}>Running Bal.</th>
                       </tr>
                     </thead>
                     <tbody>
                       {/* Calculate Running Balances locally */}
                       {(() => {
                         let running = (selected.balance_type || selected.balanceType) === "to_collect" 
                            ? Number(selected.opening_balance ?? selected.openingBalance ?? 0)
                            : -Number(selected.opening_balance ?? selected.openingBalance ?? 0);
                         
                         const rows = [{
                           id: "op-bal", dateStr: "-", particulars: "Opening Balance", dr: null, cr: null, run: running, isOp: true
                         }];

                         // transactions are sorted desc, we need asc for running ledger
                         const ascTx = [...selectedTransactions].sort((a, b) => a.date - b.date);
                         
                         ascTx.forEach(t => {
                           if (!t.isPayment) { // Invoice = Debit (Party owes us more)
                              running += t.amount;
                              rows.push({ id: t.id, dateStr: t.date.toLocaleDateString('en-IN'), particulars: `${t.type} #${t.number}`, dr: t.amount, cr: null, run: running });
                           } else { // Payment or Credit Note = Credit (Party pays us)
                              running -= t.amount;
                              rows.push({ id: t.id, dateStr: t.date.toLocaleDateString('en-IN'), particulars: `${t.type} #${t.number}`, dr: null, cr: t.amount, run: running });
                           }
                         });

                         return rows.map((r, i) => (
                           <tr key={r.id + i} style={{ borderTop: "1px solid #e5e7eb" }}>
                             <td style={{ padding: "12px", color: "#6b7280" }}>{r.dateStr}</td>
                             <td style={{ padding: "12px", fontWeight: r.isOp ? "600" : "400" }}>{r.particulars}</td>
                             <td style={{ padding: "12px", textAlign: "right", color: "#dc2626" }}>{r.dr ? fmtCur(r.dr) : "-"}</td>
                             <td style={{ padding: "12px", textAlign: "right", color: "#059669" }}>{r.cr ? fmtCur(r.cr) : "-"}</td>
                             <td style={{ padding: "12px", textAlign: "right", fontWeight: "600" }}>
                               {fmtCur(Math.abs(r.run))} {r.run > 0 ? "Dr" : r.run < 0 ? "Cr" : ""}
                             </td>
                           </tr>
                         ));
                       })()}
                     </tbody>
                    </table>
                 </div>
               )}

               {/* ---------------- ITEMS TAB ---------------- */}
               {activeTab === "items" && (
                 <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e5e7eb", padding: "16px", minHeight: "400px" }}>
                    <div style={{ fontSize: "16px", fontWeight: "700", color: "#111827", marginBottom: "16px" }}>Item Wise Summary</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                     <thead style={{ background: "#f3f4f6", color: "#4b5563" }}>
                       <tr>
                         <th style={{ padding: "12px", fontWeight: "600" }}>Item Name</th>
                         <th style={{ padding: "12px", fontWeight: "600", textAlign: "right" }}>Total Quantity</th>
                         <th style={{ padding: "12px", fontWeight: "600", textAlign: "right" }}>Total Sales Value</th>
                       </tr>
                     </thead>
                     <tbody>
                       {selectedItems.length === 0 ? (
                         <tr><td colSpan={3} style={{ padding: "32px", textAlign: "center", color: "#6b7280" }}>No items sold to this party yet.</td></tr>
                       ) : (
                         selectedItems.map((it, i) => (
                           <tr key={it.name + i} style={{ borderTop: "1px solid #e5e7eb" }}>
                             <td style={{ padding: "12px", fontWeight: "500", color: "#111827" }}>{it.name}</td>
                             <td style={{ padding: "12px", textAlign: "right", color: "#4b5563" }}>{it.qty}</td>
                             <td style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#111827" }}>{fmtCur(it.amount)}</td>
                           </tr>
                         ))
                       )}
                     </tbody>
                    </table>
                 </div>
               )}

             </div>
           </div>
        ) : (
           <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", flexDirection: "column", color: "#9ca3af" }}>
             <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "16px", opacity: 0.5 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
             <div style={{ fontSize: "18px", fontWeight: "500", color: "#6b7280" }}>Select a party to view details</div>
             <div style={{ fontSize: "14px", marginTop: "8px" }}>Or click "Create Party" to add a new one.</div>
           </div>
        )}
      </div>
      )} {/* end split-pane view */}

      {/* Modal - Kept matching original standard logic but inline styled for tailwind-agnostic robustness */}
       {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={(e) => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
          <div style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "800px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", fontSize: "18px", fontWeight: "700", color: "#111827", display:"flex", justifyContent:"space-between" }}>
              {editing ? "Edit Party" : "Create Party"}
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:"20px", color:"#9ca3af" }}>&times;</button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Party Name <span style={{color:"red"}}>*</span></label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Mobile Number</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Email</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>GSTIN</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} placeholder="29XXXX..." />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>PAN Number</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Billing Address</label>
                <textarea rows={2} style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontFamily: "inherit" }} value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                 <div style={{ flex: 1 }}>
                   <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Opening Balance</label>
                   <input type="number" style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
                 </div>
                 <div style={{ flex: 1 }}>
                   <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Balance To</label>
                   <select style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", background: "white" }} value={form.balanceType} onChange={(e) => setForm({ ...form, balanceType: e.target.value })}>
                     <option value="to_collect">To Collect (Receivable)</option>
                     <option value="to_pay">To Pay (Payable)</option>
                   </select>
                 </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Credit Period (Days)</label>
                <input type="number" style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={form.creditPeriodDays} onChange={(e) => setForm({ ...form, creditPeriodDays: e.target.value })} />
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f9fafb", borderRadius: "0 0 12px 12px" }}>
              <button onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: "10px 20px", border: "1px solid #d1d5db", background: "white", borderRadius: "6px", fontWeight: "600", color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button onClick={save} style={{ padding: "10px 24px", border: "none", background: "#4f46e5", color: "white", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Save Party</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
