import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, X, Settings } from 'lucide-react';
import { calculatePartyBalance } from './billingUtils.js';

export default function PaymentInBuilder({ advancedDraft, onClose, onSave, customers, userDetails, bills, billPayments }) {
  const isEditing = Boolean(advancedDraft?.id);
  const selectedPartyName = advancedDraft?.customer || '';

  const [date, setDate] = useState(
    advancedDraft?.createdAt ? new Date(advancedDraft.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
  const [paymentMode, setPaymentMode] = useState(advancedDraft?.terms || 'Cash');
  const [prefix, setPrefix] = useState('PI-');
  const [number, setNumber] = useState('');
  const [amountReceived, setAmountReceived] = useState(advancedDraft?.total?.toString() || '');
  const [discount, setDiscount] = useState(advancedDraft?.discount?.toString() || '');
  const [notes, setNotes] = useState(advancedDraft?.desc || '');

  // Calculate Party Balance (this is simplified, ideally we'd pass in full ledger calculating function, but we can do a rough calculation here based on bills)
  const [partyBalance, setPartyBalance] = useState(0);
  const [isSaving, setIsSaving] = useState(false); // Task 3.1 – double-submit guard

  useEffect(() => {
    if (selectedPartyName) {
      const party = customers?.find(c => c.name === selectedPartyName);
      if (party) {
         setCustomerInfo(party);
      }
      
      const balance = calculatePartyBalance(selectedPartyName, bills, billPayments, customers);
      setPartyBalance(balance);
    }
    
    // Set default number if empty
    if (!advancedDraft?.id) {
       const payInBills = bills?.filter(b => (b.docType || b.doc_type) === "Payment In") || [];
       const nums = payInBills.map(b => parseInt((b.id || "").replace('PI-', ''))).filter(n => !isNaN(n));
       const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
       
       setNumber((maxNum + 1).toString());
    } else {
       setNumber(advancedDraft.id.replace('PI-', ''));
    }
  }, [selectedPartyName, customers, bills, billPayments]);

  const handleSave = async () => { // Task 3.1 – async to support isSaving guard
    if (isSaving) return;
    if (!amountReceived || Number(amountReceived) <= 0) {
      alert("Please enter a valid amount received.");
      return;
    }
    const discountAmt = Math.max(0, Number(discount) || 0);
    // Ledger settlement = cash received + discount waived (both reduce outstanding balance)
    const settledAmount = Math.round((Number(amountReceived) + discountAmt) * 100) / 100;
    const payload = {
      ...advancedDraft,
      customer: customerInfo.name,
      phone: customerInfo.phone,
      email: customerInfo.email,
      // total drives FIFO allocation — must equal full amount settled
      total: settledAmount,
      // Store components separately for accurate reports
      amountReceived: Number(amountReceived),
      discount: discountAmt,
      createdAt: new Date(date).toISOString(),
      docType: "Payment In",
      doc_type: "Payment In",
      terms: paymentMode,
      desc: notes,
      invoiceType: "Payment In",
      status: "Closed",
      id: isEditing ? advancedDraft.id : `${prefix}${number}`
    };
    setIsSaving(true);
    try {
      await onSave(payload);
    } finally {
      setIsSaving(false);
    }
  };

  const currentBalanceColor = partyBalance > 0 ? '#ef4444' : partyBalance < 0 ? '#10b981' : '#6b7280';
  const balanceText = partyBalance > 0 ? `₹${Math.abs(partyBalance)} to collect` : partyBalance < 0 ? `₹${Math.abs(partyBalance)} advance` : '₹0';

  return (
    <div style={{ position: "fixed", inset: 0, background: "#f3f4f6", zIndex: 9999, display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif", overflowY: "auto" }}>
      {/* HEADER */}
      <div style={{ height: "64px", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid #e5e7eb", flexShrink: 0, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#4b5563", display: "flex", alignItems: "center", padding: "8px", borderRadius: "8px" }} onMouseOver={e => e.currentTarget.style.background = "#f3f4f6"} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#111827" }}>Record Payment In #{number}</h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button style={{ height: "36px", padding: "0 16px", background: "white", border: "1px solid #d1d5db", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "500", color: "#374151", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "#f9fafb"} onMouseOut={e => e.currentTarget.style.background = "white"}>
            <Settings size={16} /> <span>Settings</span>
          </button>
          <button onClick={onClose} style={{ height: "36px", padding: "0 16px", background: "white", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", fontWeight: "500", color: "#6b7280", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving} style={{ height: "36px", padding: "0 20px", background: isSaving ? "#818cf8" : "#4f46e5", border: "none", borderRadius: "6px", display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: "500", color: "white", cursor: isSaving ? "not-allowed" : "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
            <Save size={16} /> {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* TOP CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {/* Left Card */}
            <div style={{ background: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #f3f4f6" }}>
                <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Party Name</label>
                    <div style={{ position: "relative" }}>
                        <input 
                           type="text" 
                           value={customerInfo?.name || selectedPartyName} 
                           disabled
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827", background: "#f9fafb" }} 
                        />
                    </div>
                    <div style={{ marginTop: "8px", fontSize: "13px" }}>
                        <span style={{ color: "#6b7280" }}>Current Balance: </span>
                        <span style={{ color: currentBalanceColor, fontWeight: "500" }}>{balanceText}</span>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Amount Received</label>
                        <input 
                           type="number"
                           value={amountReceived}
                           onChange={e => setAmountReceived(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827" }} 
                           placeholder="0"
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Payment In Discount</label>
                        <input 
                           type="number"
                           value={discount}
                           onChange={e => setDiscount(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827" }} 
                           placeholder="0"
                        />
                    </div>
                </div>
            </div>

            {/* Right Card */}
            <div style={{ background: "white", borderRadius: "8px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #f3f4f6" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Payment Date</label>
                        <input 
                           type="date"
                           value={date}
                           onChange={e => setDate(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827" }} 
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Payment Mode</label>
                        <select 
                           value={paymentMode}
                           onChange={e => setPaymentMode(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827", appearance: "auto" }} 
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="UPI">UPI / QR Code</option>
                        </select>
                    </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Payment In Prefix</label>
                        <input 
                           type="text"
                           value={prefix}
                           onChange={e => setPrefix(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827" }} 
                           placeholder="PI-"
                        />
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Payment In Number</label>
                        <input 
                           type="text"
                           value={number}
                           onChange={e => setNumber(e.target.value)}
                           style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827" }} 
                        />
                    </div>
                </div>

                <div>
                    <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Notes</label>
                    <textarea 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Enter Notes"
                        style={{ width: "100%", border: "1px solid #d1d5db", borderRadius: "6px", padding: "10px 12px", fontSize: "14px", outline: "none", color: "#111827", minHeight: "60px", resize: "vertical" }} 
                    />
                </div>
            </div>
        </div>

        {/* TRANSACTIONS BOTTOM AREA */}
        <div style={{ background: "white", borderRadius: "8px", border: "1px dashed #d1d5db", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
            <div style={{ opacity: 0.5, marginBottom: "16px" }}>
                <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="20" width="80" height="50" rx="4" fill="#E5E7EB"/>
                <rect x="30" y="30" width="60" height="4" rx="2" fill="#D1D5DB"/>
                <rect x="30" y="40" width="40" height="4" rx="2" fill="#D1D5DB"/>
                <rect x="30" y="50" width="50" height="4" rx="2" fill="#D1D5DB"/>
                <path d="M70 40H80M75 35V45" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: "600", color: "#374151", margin: "0 0 4px 0" }}>No Transactions yet!</h3>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>No unpaid invoices found for selected party</p>
        </div>

      </div>
    </div>
  );
}
