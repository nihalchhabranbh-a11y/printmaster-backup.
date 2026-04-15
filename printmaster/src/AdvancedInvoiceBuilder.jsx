import React, { useState, useMemo, useEffect, useRef } from "react";

// Utility formatting
const fmtCur = (n) => `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  productId: "",
  name: "",
  type: "product",
  hsnSac: "",
  size: "",
  qty: 1,
  unit: "PCs", // uppercase
  rate: 0,
  discountType: "perc", // perc or amount
  discountValue: 0,
  taxRate: 0,
  amount: 0,
});

export default function AdvancedInvoiceBuilder({
  initialData, 
  customers,
  products,
  brand,
  onClose,
  onSave
}) {
  const [docType, setDocType] = useState(initialData?.docType || "Tax Invoice (GST)");
  const isGstBill = docType.includes("Tax") || docType === "Sales Invoice";
  
  const [selectedParty, setSelectedParty] = useState(() => {
    if (initialData?.customer) {
      return (customers || []).find(c => String(c.name).toLowerCase() === String(initialData.customer).toLowerCase() || c.phone === initialData.phone) || { name: initialData.customer, phone: initialData.phone };
    }
    return null;
  });
  
  // Header details
  const extractPrefixAndNumber = (id) => {
      // Very basic extraction if we have an ID
      if (!id) return null;
      let pfx = brand?.invoicePrefix || "SP/SL/26-27/";
      if (id.startsWith(pfx)) {
          return { p: pfx, n: id.replace(pfx, "") };
      }
      return { p: "", n: id };
  };

  const [invoicePrefix, setInvoicePrefix] = useState(() => {
      if (initialData?.id) return extractPrefixAndNumber(initialData.id)?.p || brand?.invoicePrefix || "SP/SL/26-27/";
      return brand?.invoicePrefix || "SP/SL/26-27/";
  });
  const [invoiceNumber, setInvoiceNumber] = useState(() => {
      if (initialData?.id) return extractPrefixAndNumber(initialData.id)?.n || brand?.invoiceCounter || 8;
      return brand?.invoiceCounter || 8;
  });

  const [docDate, setDocDate] = useState(() => {
      if (initialData?.date) {
        if (initialData.date.includes("T")) return initialData.date.split("T")[0];
        return initialData.date;
      }
      return new Date().toISOString().split("T")[0];
  });
  
  const [paymentTerms, setPaymentTerms] = useState(initialData?.termsDays || "30");
  const [dueDate, setDueDate] = useState(() => {
    if (initialData?.dueDate) {
        if (initialData.dueDate.includes("T")) return initialData.dueDate.split("T")[0];
        return initialData.dueDate;
    }
    let d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });

  const [items, setItems] = useState(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items.map(it => ({
        ...emptyItem(),
        ...it,
        name: it.name || it.desc || it.nameText || "",
        size: it.size || it.description || "",
        rate: Number(it.rate) || 0,
        qty: Number(it.qty) || 1,
        id: it.id || Date.now() + Math.random(),
      }));
    }
    return [emptyItem()];
  });
  
  const [globalDiscount, setGlobalDiscount] = useState({ type: "amount", value: initialData?.discount || 0 }); 
  const [additionalCharges, setAdditionalCharges] = useState(initialData?.additionalCharges || 0);
  const [isAutoRoundOff, setIsAutoRoundOff] = useState(initialData?.roundOff ? true : false);
  const [amountReceived, setAmountReceived] = useState(initialData?.amountReceived || "");
  const [paymentMode, setPaymentMode] = useState(initialData?.paymentMode || "Cash"); 
  
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [terms, setTerms] = useState(
    initialData?.terms || brand?.terms || "1. Goods once sold will not be taken back or exchanged\n2. All disputes are subject to local jurisdiction only"
  );
  
  const [isSaving, setIsSaving] = useState(false);
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);
  const [partySearch, setPartySearch] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  const [showNotes, setShowNotes] = useState(initialData?.notes ? true : false);
  const [showBank, setShowBank] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showAddCharges, setShowAddCharges] = useState(initialData?.additionalCharges ? true : false);
  const [showDiscount, setShowDiscount] = useState(initialData?.discount ? true : false);
  
  const [bankAccName, setBankAccName] = useState("");
  const [bankAccNo, setBankAccNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [upiId, setUpiId] = useState("");

  const partyRef = useRef(null);

  // Auto Due Date calculation
  useEffect(() => {
    if (paymentTerms && paymentTerms !== "" && docDate) {
      let d = new Date(docDate);
      d.setDate(d.getDate() + parseInt(paymentTerms, 10));
      setDueDate(d.toISOString().split("T")[0]);
    }
  }, [paymentTerms, docDate]);

  // Set initial party
  useEffect(() => {
    if (initialData?.customer) {
      const match = (customers || []).find(c => String(c.name).toLowerCase() === String(initialData.customer).toLowerCase() || c.phone === initialData.phone);
      if (match) setSelectedParty(match);
    }
  }, [initialData, customers]);

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscountLocal = 0;

    const calculatedItems = items.map(it => {
      const baseAmount = Number(it.qty) * Number(it.rate);
      let itemDiscount = 0;
      if (it.discountType === "perc") {
        itemDiscount = baseAmount * (Number(it.discountValue) / 100);
      } else {
        itemDiscount = Number(it.discountValue);
      }
      
      const taxableAmount = Math.max(0, baseAmount - itemDiscount);
      const taxAmount = isGstBill ? taxableAmount * (Number(it.taxRate) / 100) : 0;
      const finalAmount = taxableAmount + taxAmount;
      
      subtotal += baseAmount;
      totalDiscountLocal += itemDiscount;
      totalTax += taxAmount;

      return { ...it, baseAmount, itemDiscount, taxableAmount, taxAmount, amount: finalAmount };
    });

    let taxableAmountValue = subtotal - totalDiscountLocal + Number(additionalCharges);
    
    // Global discount
    let globalDiscAmount = 0;
    if (globalDiscount.type === "perc") {
      globalDiscAmount = taxableAmountValue * (Number(globalDiscount.value) / 100);
    } else {
      globalDiscAmount = Number(globalDiscount.value);
    }

    let rawTotal = taxableAmountValue - globalDiscAmount + totalTax;
    
    let finalRoundOff = 0;
    if (isAutoRoundOff && rawTotal !== Math.round(rawTotal)) {
        finalRoundOff = Math.round(rawTotal) - rawTotal;
    }
    
    let grandTotal = rawTotal + finalRoundOff;
    let balance = grandTotal - Number(amountReceived || 0);

    return { calculatedItems, subtotal, totalDiscountLocal, taxableAmountValue, totalTax, globalDiscAmount, rawTotal, finalRoundOff, grandTotal, balance };
  }, [items, globalDiscount, additionalCharges, isAutoRoundOff, amountReceived]);

  const updateItem = (index, field, value) => {
    const nextItems = [...items];
    nextItems[index][field] = value;
    setItems(nextItems);
  };

  const removeItemRow = (index) => {
    const nextItems = [...items];
    nextItems.splice(index, 1);
    // always keep at least 1 row
    if (nextItems.length === 0) {
      nextItems.push(emptyItem());
    }
    setItems(nextItems);
  };

  const addSpecificProduct = (product, qtyToAdd = 1) => {
    const newItem = emptyItem();
    newItem.productId = product.id;
    newItem.name = product.name || "";
    newItem.rate = product.price || 0;
    newItem.size = product.size || "";
    newItem.qty = qtyToAdd;
    
    // If the only item is an empty default row, replace it
    if (items.length === 1 && !items[0].name && !items[0].rate) {
      setItems([newItem]);
    } else {
      setItems([...items, newItem]);
    }
  };

  const handleBarcodeScan = () => {
    const code = window.prompt("Scan or Enter Barcode:");
    if (!code) return;
    const codeLower = code.trim().toLowerCase();
    const match = (products || []).find(p => 
      (p.item_code && p.item_code.toLowerCase() === codeLower) || 
      (p.id && p.id.toLowerCase() === codeLower) || 
      (p.name && p.name.toLowerCase() === codeLower)
    );
    if (match) {
      addSpecificProduct(match, 1);
    } else {
      alert("Product not found with barcode: " + code);
    }
  };

  const handleSave = async () => {
    if (!selectedParty) {
        alert("Please select a Party.");
        return;
    }
    const validItems = items.filter(it => it.name.trim() !== "");
    if (validItems.length === 0) {
        alert("Please add at least one item.");
        return;
    }

    setIsSaving(true);
    try {
        const docId = initialData?.id || `${invoicePrefix}${invoiceNumber}`;
        
        let finalTerms = terms;
        if (showBank && (bankAccName || bankAccNo || bankIfsc)) {
            finalTerms += `\n\nBank Details:\nAccount Name: ${bankAccName}\nAccount No: ${bankAccNo}\nIFSC: ${bankIfsc}`;
        }
        if (showQr && upiId) {
            finalTerms += `\nUPI ID: ${upiId}`;
        }

        const payload = {
            id: docId,
            docType: docType,
            date: docDate,
            dueDate: dueDate,
            termsDays: paymentTerms,
            customer: selectedParty.name,
            phone: selectedParty.phone,
            items: calculations.calculatedItems,
            subtotal: calculations.subtotal,
            totalTax: calculations.totalTax,
            discount: calculations.totalDiscountLocal + calculations.globalDiscAmount,
            additionalCharges: Number(additionalCharges),
            roundOff: calculations.finalRoundOff,
            total: calculations.grandTotal,
            amountReceived: Number(amountReceived),
            paymentMode: paymentMode,
            notes: notes,
            terms: finalTerms
        };

        if (onSave) {
            await onSave(payload);
        }
    } finally {
        setIsSaving(false);
    }
  };

  const filteredParties = (customers || []).filter(c => 
    c.name?.toLowerCase().includes(partySearch.toLowerCase()) || 
    c.phone?.includes(partySearch)
  );

  const filteredProducts = (products || []).filter(p => 
    p.name?.toLowerCase().includes(itemSearch.toLowerCase()) ||
    p.size?.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyForm, setPartyForm] = useState({
    name: "", phone: "", email: "", gstin: "", panNumber: "",
    billingAddress: "", openingBalance: 0, balanceType: "to_collect", creditPeriodDays: 30
  });

  const handleOpenPartyModal = () => {
    setPartyForm({
      name: "", phone: "", email: "", gstin: "", panNumber: "",
      billingAddress: "", openingBalance: 0, balanceType: "to_collect", creditPeriodDays: 30
    });
    setShowPartyModal(true);
    setShowPartyDropdown(false);
  };

  const handleSavePartyModal = () => {
    if (!partyForm.name.trim()) return alert("Enter Party Name");
    
    // Using old wiring method: just setting the selectedParty locally.
    // The main app logic will extract the party details when the invoice saves.
    const newParty = { 
      id: Date.now().toString(), 
      name: partyForm.name, 
      phone: partyForm.phone,
      email: partyForm.email,
      gstin: partyForm.gstin,
      panNumber: partyForm.panNumber,
      billingAddress: partyForm.billingAddress,
      openingBalance: partyForm.openingBalance,
      balanceType: partyForm.balanceType,
      creditPeriodDays: partyForm.creditPeriodDays
    };
    setSelectedParty(newParty);
    setShowPartyModal(false);
    setPartySearch("");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#f9fafb", zIndex:9999, display:"flex", flexDirection:"column", fontFamily:"Inter, sans-serif" }}>
      {/* Header */}
      <div style={{ background:"#312e81", color:"white", padding:"12px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", height:"64px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"white", padding:"4px" }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={{ fontSize:"16px", fontWeight:"600", color:"#111827", background:"white", border:"1px solid #d1d5db", borderRadius:"6px", padding:"4px 8px", outline:"none", marginLeft:"8px" }}>
                  <option value="Tax Invoice (GST)">Create Tax Invoice (GST)</option>
                  <option value="Bill of Supply (Non-GST)">Create Bill of Supply (Non-GST)</option>
                  <option value="Quotation">Create Quotation</option>
              </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", background:"white", color:"#374151", border:"1px solid #d1d5db", borderRadius:"6px", fontWeight:"500", fontSize:"13px", cursor:"pointer" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                  Settings
              </button>
              <button disabled={isSaving} onClick={handleSave} style={{ padding:"8px 16px", background:"white", color:"#4f46e5", border:"1px solid #e5e7eb", borderRadius:"6px", fontWeight:"600", fontSize:"13px", cursor:"pointer" }}>
                  Save & New
              </button>
              <button disabled={isSaving} onClick={handleSave} style={{ padding:"8px 24px", background:"#e0e7ff", color:"#4f46e5", border:"none", borderRadius:"6px", fontWeight:"600", fontSize:"13px", cursor: isSaving ? "not-allowed" : "pointer" }}>
                  {isSaving ? "Saving..." : "Save"}
              </button>
          </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          <div style={{ background: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", display:"flex", flexDirection:"column" }}>
              
              {/* Form Top: Bill To & Invoice Info */}
              <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
                  
                  {/* Left: Bill To */}
                  <div style={{ flex: 1, padding: "24px", borderRight: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize:"13px", fontWeight:"600", color:"#4b5563", marginBottom:"12px" }}>Bill To</div>
                      <div style={{ position:"relative" }} ref={partyRef}>
                          {!selectedParty ? (
                              <div 
                                onClick={() => setShowPartyDropdown(!showPartyDropdown)}
                                style={{ border:"2px dashed #93c5fd", borderRadius:"6px", padding:"32px", display:"flex", justifyContent:"center", alignItems:"center", cursor:"pointer", background:"#eff6ff", color:"#3b82f6", fontWeight:"500", fontSize:"14px" }}
                              >
                                  + Add Party
                              </div>
                          ) : (
                              <div style={{ border:"1px solid #d1d5db", borderRadius:"6px", padding:"16px", display:"flex", justifyContent:"space-between" }}>
                                  <div>
                                      <div style={{ fontWeight:"600", fontSize:"16px", color:"#111827", marginBottom:"4px" }}>{selectedParty.name}</div>
                                      <div style={{ fontSize:"13px", color:"#4b5563" }}>{selectedParty.phone || "No phone"}</div>
                                  </div>
                                  <button onClick={() => setSelectedParty(null)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", padding:"8px" }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                  </button>
                              </div>
                          )}

                          {showPartyDropdown && !selectedParty && (
                              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"white", border:"1px solid #d1d5db", borderRadius:"6px", boxShadow:"0 10px 15px -3px rgba(0,0,0,0.1)", zIndex:50, marginTop:"4px", overflow:"hidden" }}>
                                  <div style={{ padding:"8px", borderBottom:"1px solid #e5e7eb" }}>
                                      <input 
                                        autoFocus
                                        type="text" 
                                        placeholder="Search party by name or number" 
                                        value={partySearch}
                                        onChange={e => setPartySearch(e.target.value)}
                                        style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", outline:"none", fontSize:"13px", background:"#f9fafb" }}
                                      />
                                  </div>
                                  <div style={{ maxHeight:"220px", overflowY:"auto" }}>
                                      <div style={{ display:"flex", padding:"8px 12px", fontSize:"12px", color:"#6b7280", fontWeight:"600", borderBottom:"1px solid #f3f4f6" }}>
                                          <div style={{ flex:1 }}>Party Name</div>
                                          <div style={{ width:"80px", textAlign:"right" }}>Balance</div>
                                      </div>
                                      {filteredParties.map(p => (
                                          <div 
                                            key={p.id} 
                                            onClick={() => { setSelectedParty(p); setShowPartyDropdown(false); setPartySearch(""); }}
                                            style={{ display:"flex", padding:"10px 12px", borderBottom:"1px solid #f3f4f6", cursor:"pointer", fontSize:"13px", cursor:"pointer" }}
                                            onMouseOver={e => e.currentTarget.style.background="#f9fafb"}
                                            onMouseOut={e => e.currentTarget.style.background="white"}
                                          >
                                              <div style={{ flex:1, color:"#111827" }}>{p.name}</div>
                                              <div style={{ width:"80px", textAlign:"right", color:"#6b7280" }}>₹0</div>
                                          </div>
                                      ))}
                                      {filteredParties.length === 0 && (
                                          <div style={{ padding:"16px", textAlign:"center", fontSize:"13px", color:"#6b7280" }}>No parties found</div>
                                      )}
                                  </div>
                                  <div onClick={handleOpenPartyModal} style={{ padding:"8px", background:"#eff6ff", borderTop:"1px solid #bfdbfe", cursor:"pointer", color:"#2563eb", fontSize:"13px", fontWeight:"600", textAlign:"center" }}>
                                      + Create Party
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Right: Invoice Info */}
                  <div style={{ flex: 1, padding: "24px", display:"flex", gap:"16px", flexWrap:"wrap" }}>
                      <div style={{ flex:"1 1 calc(50% - 8px)" }}>
                          <label style={{ display:"block", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>Invoice Prefix</label>
                          <input type="text" value={invoicePrefix} readOnly style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", background:"#f9fafb", fontSize:"13px", outline:"none" }} />
                      </div>
                      <div style={{ flex:"1 1 calc(50% - 8px)" }}>
                          <label style={{ display:"block", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>Invoice Number</label>
                          <input type="text" value={invoiceNumber} readOnly style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", background:"#f9fafb", fontSize:"13px", outline:"none" }} />
                      </div>
                      <div style={{ flex:"1 1 calc(50% - 8px)" }}>
                          <label style={{ display:"block", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>Date:</label>
                          <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} style={{ width:"100%", padding:"8px", border:"1px solid #d1d5db", borderRadius:"4px", fontSize:"13px", outline:"none" }} />
                      </div>
                      
                      <div style={{ flex:"1 1 100%", display:"flex", gap:"16px" }}>
                          <div style={{ flex: 1 }}>
                              <label style={{ display:"block", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>Payment Terms</label>
                              <div style={{ display:"flex", border:"1px solid #d1d5db", borderRadius:"4px", overflow:"hidden" }}>
                                  <input type="number" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} style={{ width:"100%", flex:1, padding:"8px", border:"none", fontSize:"13px", outline:"none" }} />
                                  <div style={{ padding:"8px", background:"#f3f4f6", fontSize:"13px", color:"#6b7280", borderLeft:"1px solid #d1d5db" }}>days</div>
                              </div>
                          </div>
                          <div style={{ flex: 1 }}>
                              <label style={{ display:"block", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>Due Date:</label>
                              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", background:"#f9fafb", fontSize:"13px", outline:"none", color:"#6b7280" }} />
                          </div>
                      </div>
                  </div>
              </div>

              {/* Items Table */}
              <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                          <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"4%" }}>NO</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width: isGstBill ? "22%" : "30%" }}>ITEMS/ SERVICES</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"10%" }}>HSN/ SAC</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"10%" }}>SIZE</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"8%" }}>QTY</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"12%" }}>PRICE/ITEM (₹)</th>
                              <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"12%" }}>DISCOUNT</th>
                              {isGstBill && <th style={{ padding: "10px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"8%" }}>TAX</th>}
                              <th style={{ padding: "10px 16px", fontSize: "11px", fontWeight: "600", color: "#6b7280", textTransform:"uppercase", width:"10%" }}>AMOUNT (₹)</th>
                              <th style={{ width:"4%", padding:"10px" }}></th>
                          </tr>
                      </thead>
                      <tbody>
                          {items.map((it, idx) => (
                              <tr key={it.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                  <td style={{ padding: "12px 16px", color: "#9ca3af", fontSize:"13px" }}>{idx + 1}</td>
                                  <td style={{ padding: "12px" }}>
                                      <input type="text" placeholder="Item Name" value={it.name} onChange={e => updateItem(idx, 'name', e.target.value)} style={{ width:"100%", padding:"6px", border:"none", background:"transparent", outline:"none", fontSize:"13px", borderBottom:"1px solid transparent" }} onFocus={e=>e.target.style.borderBottom="1px solid #3b82f6"} onBlur={e=>e.target.style.borderBottom="1px solid transparent"}/>
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <input type="text" placeholder="" value={it.hsnSac} onChange={e => updateItem(idx, 'hsnSac', e.target.value)} style={{ width:"100%", padding:"6px", border:"none", background:"transparent", outline:"none", fontSize:"13px" }} />
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <input type="text" placeholder="Size" value={it.size} onChange={e => updateItem(idx, 'size', e.target.value)} style={{ width:"100%", padding:"6px", border:"none", background:"transparent", outline:"none", fontSize:"13px" }} />
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <input type="number" min="1" value={it.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} style={{ width:"60px", padding:"6px", border:"1px solid #e5e7eb", borderRadius:"4px", outline:"none", fontSize:"13px" }} />
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <input type="number" min="0" value={it.rate} onChange={e => updateItem(idx, 'rate', e.target.value)} style={{ width:"80px", padding:"6px", border:"1px solid #e5e7eb", borderRadius:"4px", outline:"none", fontSize:"13px" }} />
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <div style={{ display:"flex", border:"1px solid #e5e7eb", borderRadius:"4px", overflow:"hidden" }}>
                                          <input type="number" min="0" value={it.discountValue} onChange={e => updateItem(idx, 'discountValue', e.target.value)} style={{ width:"60%", padding:"6px", border:"none", outline:"none", borderRight:"1px solid #e5e7eb", fontSize:"13px" }} />
                                          <select value={it.discountType} onChange={e => updateItem(idx, 'discountType', e.target.value)} style={{ width:"40%", padding:"6px 2px", border:"none", outline:"none", background:"#f9fafb", fontSize:"12px" }}>
                                              <option value="perc">%</option>
                                              <option value="amount">₹</option>
                                          </select>
                                      </div>
                                  </td>
                                  {isGstBill && (
                                  <td style={{ padding: "12px" }}>
                                      <select value={it.taxRate} onChange={e => updateItem(idx, 'taxRate', e.target.value)} style={{ width:"100%", padding:"6px", border:"none", outline:"none", background:"transparent", fontSize:"13px", height:"30px" }}>
                                          <option value="0">0%</option>
                                          <option value="5">5%</option>
                                          <option value="12">12%</option>
                                          <option value="18">18%</option>
                                          <option value="28">28%</option>
                                      </select>
                                  </td>
                                  )}
                                  <td style={{ padding: "12px 16px", fontSize:"13px", fontWeight:"500", color:"#111827" }}>
                                      {(calculations.calculatedItems[idx]?.amount || 0).toFixed(2)}
                                  </td>
                                  <td style={{ padding: "12px" }}>
                                      <button onClick={() => removeItemRow(idx)} style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer" }} onMouseOver={e=>e.currentTarget.style.color="#ef4444"} onMouseOut={e=>e.currentTarget.style.color="#9ca3af"}>
                                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  
                  {/* Add Item Trigger Row */}
                  <div style={{ padding: "16px 24px", display:"flex", gap:"16px", borderBottom: "1px solid #e5e7eb" }}>
                      <div 
                        onClick={() => setShowItemModal(true)}
                        style={{ flex: 1, border:"2px dashed #93c5fd", borderRadius:"6px", padding:"12px", display:"flex", justifyContent:"center", alignItems:"center", cursor:"pointer", color:"#3b82f6", fontWeight:"500", fontSize:"13px", background:"white" }}
                      >
                          + Add Item
                      </div>
                      <div 
                          onClick={handleBarcodeScan}
                          style={{ width: "220px", border:"1px solid #d1d5db", borderRadius:"6px", display:"flex", alignItems:"center", padding:"8px 12px", gap:"12px", cursor:"pointer", background:"white" }}
                      >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
                          <span style={{ fontSize:"13px", fontWeight:"500", color:"#374151" }}>Scan Barcode</span>
                      </div>
                  </div>

                  {/* Subtotal Row */}
                  <div style={{ display:"flex", padding:"12px 24px", justifyContent:"flex-end", borderBottom:"1px solid #e5e7eb", background:"#f9fafb" }}>
                      <div style={{ width:"300px", display:"flex" }}>
                          <div style={{ flex:1, fontSize:"12px", fontWeight:"600", color:"#6b7280" }}>SUBTOTAL</div>
                          {isGstBill && <div style={{ width:"60px", fontSize:"12px", color:"#111827", textAlign:"right" }}>₹{calculations.totalTax.toFixed(2)}</div>}
                          <div style={{ width:"80px", fontSize:"12px", color:"#111827", textAlign:"right", paddingLeft:"12px" }}>- ₹{calculations.totalDiscountLocal.toFixed(2)}</div>
                          <div style={{ width:"100px", fontSize:"13px", fontWeight:"600", color:"#111827", textAlign:"right" }}>₹{calculations.subtotal.toFixed(2)}</div>
                      </div>
                  </div>
              </div>

              {/* Bottom Section */}
              <div style={{ display: "flex", flexWrap: "wrap", flex: 1 }}>
                  {/* Left Column (Notes, Terms, Bank) */}
                  <div style={{ flex: 1, minWidth: "300px", borderRight: "1px solid #e5e7eb" }}>
                      <div style={{ padding:"16px 24px", borderBottom:"1px solid #e5e7eb" }}>
                          <div onClick={() => setShowNotes(!showNotes)} style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", cursor:"pointer", marginBottom:"8px" }}>
                              {showNotes ? "- Remove Notes" : "+ Add Notes"}
                          </div>
                          {showNotes && (
                              <textarea 
                                rows="2" 
                                placeholder="Add specific notes for this invoice..."
                                value={notes} 
                                onChange={e => setNotes(e.target.value)} 
                                style={{ width:"100%", padding:"12px", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:"6px", outline:"none", fontSize:"12px", color:"#4b5563", resize:"vertical", fontFamily:"inherit", marginBottom:"12px" }}
                              ></textarea>
                          )}
                          
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
                              <span style={{ fontSize:"13px", color:"#374151", fontWeight:"500" }}>Terms and Conditions</span>
                          </div>
                          <textarea 
                            rows="4" 
                            value={terms} 
                            onChange={e => setTerms(e.target.value)} 
                            style={{ width:"100%", padding:"12px", background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:"6px", outline:"none", fontSize:"12px", color:"#4b5563", resize:"vertical", fontFamily:"inherit" }}
                          ></textarea>
                      </div>
                      <div style={{ padding:"16px 24px", borderBottom:"1px solid #e5e7eb", display:"flex", flexDirection:"column", gap:"16px" }}>
                          {!(brand?.bankAccount) ? (
                              <div>
                                  <div onClick={() => setShowBank(!showBank)} style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", cursor:"pointer" }}>
                                      {showBank ? "- Remove Bank Account" : "+ Add Bank Account"}
                                  </div>
                                  {showBank && (
                                      <div style={{ marginTop:"8px", fontSize:"12px", color:"#6b7280" }}>
                                          <input type="text" placeholder="Account Name" value={bankAccName} onChange={e => setBankAccName(e.target.value)} style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", marginBottom:"4px", fontSize:"12px", outline:"none" }} />
                                          <input type="text" placeholder="Account Number" value={bankAccNo} onChange={e => setBankAccNo(e.target.value)} style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", marginBottom:"4px", fontSize:"12px", outline:"none" }} />
                                          <input type="text" placeholder="IFSC Code" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", outline:"none" }} />
                                      </div>
                                  )}
                              </div>
                          ) : (
                              <div style={{ fontSize:"12px", color:"#059669", fontWeight:"500", padding:"4px 0" }}>
                                  ✓ Bank details configured in settings
                              </div>
                          )}
                          {!(brand?.paymentQr) ? (
                              <div>
                                  <div onClick={() => setShowQr(!showQr)} style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", cursor:"pointer" }}>
                                      {showQr ? "- Remove Payment QR" : "+ Add Payment QR"}
                                  </div>
                                  {showQr && (
                                      <div style={{ marginTop:"8px", fontSize:"12px", color:"#6b7280" }}>
                                          <input type="text" placeholder="UPI ID (e.g., name@bank)" value={upiId} onChange={e => setUpiId(e.target.value)} style={{ width:"100%", padding:"8px", border:"1px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", outline:"none" }} />
                                      </div>
                                  )}
                              </div>
                          ) : (
                              <div style={{ fontSize:"12px", color:"#059669", fontWeight:"500", padding:"4px 0" }}>
                                  ✓ Payment QR configured in settings
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Right Column (Calculation Summary) */}
                  <div style={{ width: "450px" }}>
                      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display:"flex", flexDirection:"column", gap:"12px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                                 <span onClick={() => { if(showAddCharges) setAdditionalCharges(0); setShowAddCharges(!showAddCharges); }} style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", cursor:"pointer" }}>
                                    {showAddCharges ? "- Remove Additional Charges" : "+ Add Additional Charges"}
                                 </span>
                              </div>
                              {showAddCharges && (
                                 <input type="number" value={additionalCharges} onChange={e => setAdditionalCharges(e.target.value)} style={{ width:"80px", padding:"4px", border:"1px solid #d1d5db", borderRadius:"4px", textAlign:"right", outline:"none", fontSize:"13px" }} placeholder="0" />
                              )}
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between" }}>
                              <span style={{ fontSize:"13px", color:"#374151", fontWeight:"500" }}>Taxable Amount</span>
                              <span style={{ fontSize:"13px", color:"#111827" }}>₹{calculations.taxableAmountValue.toFixed(2)}</span>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                                  <span onClick={() => { if(showDiscount) setGlobalDiscount({...globalDiscount, value:0}); setShowDiscount(!showDiscount); }} style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", cursor:"pointer" }}>
                                     {showDiscount ? "- Remove Discount" : "+ Add Discount"}
                                  </span>
                              </div>
                              {showDiscount && (
                                  <div style={{ display:"flex", alignItems:"center", border:"1px solid #d1d5db", borderRadius:"4px", overflow:"hidden", width:"120px" }}>
                                      <input type="number" min="0" value={globalDiscount.value} onChange={e=>setGlobalDiscount({...globalDiscount, value: e.target.value})} style={{ width:"60%", padding:"4px", border:"none", outline:"none", fontSize:"13px", textAlign:"right", borderRight:"1px solid #d1d5db" }} />
                                      <select value={globalDiscount.type} onChange={e=>setGlobalDiscount({...globalDiscount, type: e.target.value})} style={{ width:"40%", padding:"4px", border:"none", outline:"none", background:"#f3f4f6", fontSize:"13px" }}>
                                          <option value="amount">₹</option>
                                          <option value="perc">%</option>
                                      </select>
                                  </div>
                              )}
                          </div>
                          
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px" }}>
                              <label style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer" }}>
                                  <input type="checkbox" checked={isAutoRoundOff} onChange={e => setIsAutoRoundOff(e.target.checked)} style={{ width:"16px", height:"16px", accentColor:"#4f46e5" }} />
                                  <span style={{ fontSize:"13px", color:"#374151" }}>Auto Round Off</span>
                              </label>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                                  {isAutoRoundOff && calculations.finalRoundOff !== 0 && (
                                      <span style={{ fontSize:"12px", color:"#6b7280" }}>{calculations.finalRoundOff > 0 ? "+" : ""} {calculations.finalRoundOff.toFixed(2)}</span>
                                  )}
                                  <div style={{ background:"#f3f4f6", border:"1px solid #e5e7eb", borderRadius:"4px", padding:"4px 8px", fontSize:"13px", color:"#6b7280" }}>+ Add</div>
                                  <span style={{ fontSize:"13px", color:"#111827", display:"flex", alignItems:"center", gap:"4px" }}>
                                      <span>₹</span>
                                      <input type="number" step="0.01" value={calculations.finalRoundOff} onChange={e => setIsAutoRoundOff(false) || setRoundOff(e.target.value)} style={{ width:"50px", padding:"2px", border:"none", background:"transparent", outline:"none", textAlign:"right" }} disabled={isAutoRoundOff} />
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", background:"#f9fafb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <span style={{ fontSize:"14px", fontWeight:"600", color:"#111827" }}>Total Amount</span>
                          <span style={{ fontSize:"16px", fontWeight:"700", color:"#111827", background:"#e0e7ff", padding:"6px 12px", borderRadius:"4px", border:"1px solid #c7d2fe" }}>
                             {fmtCur(calculations.grandTotal)}
                          </span>
                      </div>

                      <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                              <label style={{ fontSize:"13px", fontWeight:"500", color:"#374151" }}>Amount Received</label>
                              <div style={{ display:"flex", alignItems:"center", border:"1px solid #d1d5db", borderRadius:"4px", overflow:"hidden" }}>
                                  <div style={{ padding:"6px 10px", background:"#f3f4f6", color:"#6b7280", fontSize:"13px", borderRight:"1px solid #d1d5db" }}>₹</div>
                                  <input type="number" min="0" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0" style={{ width:"100px", padding:"6px", border:"none", outline:"none", fontSize:"14px" }} />
                                  <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ padding:"6px", border:"none", outline:"none", borderLeft:"1px solid #d1d5db", background:"transparent", fontSize:"13px" }}>
                                      <option value="Cash">Cash</option>
                                      <option value="Bank">Bank</option>
                                      <option value="Cheque">Cheque</option>
                                  </select>
                              </div>
                          </div>
                          
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"16px" }}>
                              <span style={{ fontSize:"13px", fontWeight:"500", color:"#10b981" }}>Balance Amount</span>
                              <span style={{ fontSize:"14px", fontWeight:"600", color:"#10b981" }}>
                                  {fmtCur(Math.max(0, calculations.balance))}
                              </span>
                          </div>
                      </div>

                      <div style={{ padding: "24px", textAlign:"right", height:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                          <div style={{ fontSize:"11px", color:"#4b5563", marginBottom:"4px" }}>Authorized signatory for <strong style={{color:"#111827"}}>{brand?.shopName || "SHIROMANI PRINTERS"}</strong></div>
                          <div style={{ width:"180px", height:"60px", border:"1px dashed #d1d5db", marginLeft:"auto", borderRadius:"4px", background:"#f9fafb", marginTop:"24px" }}></div>
                      </div>
                  </div>
              </div>
          </div>
      </div>

      {/* Add Items Modal */}
      {showItemModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"white", width:"800px", maxWidth:"95vw", height:"600px", maxHeight:"90vh", borderRadius:"12px", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:"16px", fontWeight:"600", color:"#111827" }}>Add Items to Bill</div>
              <button onClick={() => setShowItemModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #e5e7eb", display:"flex", gap:"16px", alignItems:"center" }}>
              <div style={{ flex:1, position:"relative" }}>
                 <svg style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 <input 
                   autoFocus
                   type="text" 
                   placeholder="Search by Item / Serial no. / HSN code/ SKU/ Custom Field / Category" 
                   value={itemSearch}
                   onChange={e => setItemSearch(e.target.value)}
                   style={{ width:"100%", padding:"10px 10px 10px 36px", border:"1px solid #d1d5db", borderRadius:"6px", outline:"none", fontSize:"13px" }}
                 />
                 <svg style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", color:"#9ca3af" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>
              </div>
              <select style={{ padding:"10px", border:"1px solid #d1d5db", borderRadius:"6px", fontSize:"13px", background:"white", outline:"none", minWidth:"150px", color:"#6b7280" }}>
                <option value="">Select Category</option>
              </select>
              <button style={{ padding:"10px 20px", background:"#4f46e5", color:"white", border:"none", borderRadius:"6px", fontWeight:"600", fontSize:"13px", cursor:"pointer" }}>
                Create New Item
              </button>
            </div>

            <div style={{ flex:1, overflowY:"auto", background:"white" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", position:"sticky", top:0, background:"#f9fafb", zIndex:1 }}>
                    <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight:"600", color:"#4b5563" }}>Item Name</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight:"600", color:"#4b5563" }}>Item Code</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight:"600", color:"#4b5563" }}>Stock</th>
                    <th style={{ padding: "12px 16px", fontSize: "12px", fontWeight:"600", color:"#4b5563" }}>Sales Price</th>
                    <th style={{ padding: "12px 24px", fontSize: "12px", fontWeight:"600", color:"#4b5563", textAlign:"right" }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6", cursor:"pointer" }} onMouseOver={e=>e.currentTarget.style.background="#f9fafb"} onMouseOut={e=>e.currentTarget.style.background="white"}>
                      <td style={{ padding: "16px 24px", fontSize:"13px", fontWeight:"500", color:"#111827" }}>{p.name} {p.size ? `(${p.size})` : ''}</td>
                      <td style={{ padding: "16px", fontSize:"13px", color:"#6b7280" }}>-</td>
                      <td style={{ padding: "16px", fontSize:"13px", color:"#6b7280" }}>{p.stockCount ?? 100} PCS</td>
                      <td style={{ padding: "16px", fontSize:"13px", color:"#111827", fontWeight:"500" }}>₹{p.price}</td>
                      <td style={{ padding: "16px 24px", textAlign:"right" }}>
                        <button 
                          onClick={() => { addSpecificProduct(p, 1); }}
                          style={{ padding:"6px 16px", background:"#eff6ff", color:"#3b82f6", border:"1px solid #bfdbfe", borderRadius:"4px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}
                        >
                          + Add
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding:"32px", textAlign:"center", color:"#6b7280", fontSize:"14px" }}>
                        No items found matching "{itemSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div style={{ padding:"16px 24px", borderTop:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#f9fafb" }}>
               <div style={{ fontSize:"12px", color:"#6b7280" }}>
                 Keyboard Shortcuts: <strong style={{color:"#4b5563"}}>Change Quantity</strong> <kbd style={{background:"white", border:"1px solid #d1d5db", padding:"2px 6px", borderRadius:"4px", margin:"0 4px"}}>Enter</kbd> &nbsp; <strong style={{color:"#4b5563"}}>Move between items</strong> <kbd style={{background:"white", border:"1px solid #d1d5db", padding:"2px 6px", borderRadius:"4px", margin:"0 4px"}}>↓↑</kbd>
               </div>
               <div style={{ display:"flex", gap:"12px", alignItems:"center" }}>
                 <div style={{ fontSize:"13px", color:"#3b82f6", fontWeight:"500", marginRight:"12px" }}>Show {items.filter(i => i.name).length} item(s) Selected</div>
                 <button onClick={() => setShowItemModal(false)} style={{ padding:"8px 16px", background:"white", border:"1px solid #d1d5db", borderRadius:"6px", fontSize:"13px", fontWeight:"600", cursor:"pointer", color:"#4b5563" }}>
                   Cancel [ESC]
                 </button>
                 <button onClick={() => setShowItemModal(false)} style={{ padding:"8px 24px", background:"white", border:"1px solid #d1d5db", color:"#3b82f6", borderRadius:"6px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
                   Add to Bill [F7]
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showPartyModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }} onClick={(e) => e.target === e.currentTarget && setShowPartyModal(false)}>
          <div style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "800px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", fontSize: "18px", fontWeight: "700", color: "#111827", display:"flex", justifyContent:"space-between" }}>
              Create Party
              <button onClick={() => setShowPartyModal(false)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:"20px", color:"#9ca3af" }}>&times;</button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Party Name <span style={{color:"red"}}>*</span></label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.name} onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Mobile Number</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.phone} onChange={(e) => setPartyForm({ ...partyForm, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Email</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.email} onChange={(e) => setPartyForm({ ...partyForm, email: e.target.value })} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>GSTIN</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.gstin} onChange={(e) => setPartyForm({ ...partyForm, gstin: e.target.value.toUpperCase() })} placeholder="29XXXX..." />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>PAN Number</label>
                <input style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.panNumber} onChange={(e) => setPartyForm({ ...partyForm, panNumber: e.target.value.toUpperCase() })} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Billing Address</label>
                <textarea rows={2} style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontFamily: "inherit" }} value={partyForm.billingAddress} onChange={(e) => setPartyForm({ ...partyForm, billingAddress: e.target.value })} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                 <div style={{ flex: 1 }}>
                   <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Opening Balance</label>
                   <input type="number" style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.openingBalance} onChange={(e) => setPartyForm({ ...partyForm, openingBalance: e.target.value })} />
                 </div>
                 <div style={{ flex: 1 }}>
                   <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Balance To</label>
                   <select style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", background: "white" }} value={partyForm.balanceType} onChange={(e) => setPartyForm({ ...partyForm, balanceType: e.target.value })}>
                     <option value="to_collect">To Collect (Receivable)</option>
                     <option value="to_pay">To Pay (Payable)</option>
                   </select>
                 </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "4px" }}>Credit Period (Days)</label>
                <input type="number" style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px" }} value={partyForm.creditPeriodDays} onChange={(e) => setPartyForm({ ...partyForm, creditPeriodDays: e.target.value })} />
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: "12px", background: "#f9fafb", borderRadius: "0 0 12px 12px" }}>
              <button onClick={() => setShowPartyModal(false)} style={{ padding: "10px 20px", border: "1px solid #d1d5db", background: "white", borderRadius: "6px", fontWeight: "600", color: "#374151", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSavePartyModal} style={{ padding: "10px 24px", border: "none", background: "#4f46e5", color: "white", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>Save Party</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
