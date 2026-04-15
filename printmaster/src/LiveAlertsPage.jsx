import { useMemo, useState } from "react";
import { getBillPaymentInfo } from "./billingUtils.js";

const FONT_LINK = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`;

const STYLE = `
  ${FONT_LINK}
  @keyframes pulseRed {
    0%, 100% { box-shadow: 0 0 0 0 rgba(158,63,78,0.3); }
    50%       { box-shadow: 0 0 0 8px rgba(158,63,78,0); }
  }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes monkeyBounce {
    0%,100% { transform:translateY(0) rotate(-5deg); }
    25%     { transform:translateY(-10px) rotate(5deg); }
    75%     { transform:translateY(-6px) rotate(3deg); }
  }
  @keyframes starPop {
    0%   { transform:scale(1); }
    50%  { transform:scale(1.5); }
    100% { transform:scale(1); }
  }
  .monkey-emoji { display:inline-block; font-size:2.6rem; animation:monkeyBounce 0.55s ease-in-out infinite; line-height:1; }
  .alert-card {
    background:#fff; border-radius:28px;
    box-shadow:0 12px 32px rgba(0,112,243,0.13), 0 2px 8px rgba(0,0,0,0.04);
    display:flex; flex-direction:column; flex:1; overflow:hidden;
    animation:slideUp 0.4s ease both;
    transition:box-shadow 0.3s, transform 0.3s;
    min-height:0;
  }
  .alert-card:hover { box-shadow:0 20px 48px rgba(0,112,243,0.20), 0 4px 12px rgba(0,0,0,0.06); transform:translateY(-2px); }
  .alert-row {
    display:flex; justify-content:space-between; align-items:center;
    padding:13px 18px; border-radius:16px; margin-bottom:8px;
    transition:background 0.2s;
  }
  .alert-row:hover { background:#f8faff !important; }
  .pill-red   { background:#fee2e2; color:#9e3f4e; font-size:0.72rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; padding:5px 11px; border-radius:999px; animation:pulseRed 2.5s ease infinite; white-space:nowrap; }
  .pill-orange{ background:#fff7ed; color:#c2410c; font-size:0.72rem; font-weight:800; letter-spacing:0.07em; text-transform:uppercase; padding:5px 11px; border-radius:999px; white-space:nowrap; }
  .pill-mode  { background:#f1f5f9; color:#334155; font-size:0.68rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; padding:3px 9px; border-radius:999px; }
  .bubble-text { background:#fff; border:1.5px solid #e2e8f0; color:#0f172a; padding:9px 20px; border-radius:30px 30px 0 30px; box-shadow:0 8px 20px rgba(0,112,243,0.12); font-size:1.1rem; font-weight:800; }
  .card-label { font-size:0.67rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:6px; }
  .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:140px; gap:8px; color:#94a3b8; }
  .star-btn { background:none; border:none; cursor:pointer; font-size:1.3rem; padding:4px; border-radius:8px; transition:transform 0.15s; line-height:1; }
  .star-btn:hover { transform:scale(1.3); }
  .star-btn.starred { animation:starPop 0.3s ease; }
  .section-toggle { background:none; border:none; cursor:pointer; font-size:0.78rem; font-weight:700; color:#64748b; display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:10px; transition:background 0.15s; }
  .section-toggle:hover { background:#f1f5f9; }
  .important-row { background:#fff9e6 !important; border-left:3px solid #f59e0b; }
  .monkey-bar { background:#fff; border-bottom:1px solid #f1f5f9; padding:8px 0; box-shadow:0 4px 16px rgba(0,112,243,0.07); }
`;

export default function LiveAlertsPage({ tasks, products, bills, billPayments, onViewCustomer, onNavigate }) {
  const [note, setNote] = useState("");
  const [important, setImportant] = useState({});
  const [collapsed, setCollapsed] = useState({});

  const toggleImportant = id => setImportant(p => ({ ...p, [id]: !p[id] }));
  const toggleCollapse  = key => setCollapsed(p => ({ ...p, [key]: !p[key] }));

  const overdueTasks = useMemo(() => {
    return (tasks || [])
      .filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== "Completed" && !(t.title || "").includes("Restock Required"))
      .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
  }, [tasks]);

  const outOfStock = useMemo(() =>
    (products || []).filter(p => {
      const qty = Number(p.opening_stock ?? p.openingStock ?? 0);
      return qty === 0 && p.active !== false && p.category !== "service";
    }), [products]);

  const todayPayments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    
    // Build a quick bill lookup map: bill_id → bill (for resolving customer names)
    const billMap = {};
    (bills || []).forEach(b => { if (b.id) billMap[b.id] = b; });

    // 1. Get payments from the specific bill_payments table
    //    bill_payments rows don't store customer name — look it up from the linked bill
    const explicitPayments = (billPayments || []).filter(p =>
      (p.payment_date || p.paymentDate || p.paid_at || p.paidAt || p.created_at || "").startsWith(today)
    ).map(p => {
      const linkedBill = billMap[p.bill_id || p.billId];
      const customerName = linkedBill
        ? (linkedBill.customer || linkedBill.customer_name || linkedBill.customerName || "")
        : (p.payee_name || p.customer || p.party_name || "");
      return {
        ...p,
        displayAmount: Number(p.amount || 0),
        displayName: customerName || "Walk-In",
        displayType: "Invoice Payment",
        phone: linkedBill?.phone || p.phone || "",
      };
    });

    // 2. Get direct 'Payment In' records from the main bills table
    const directPayments = (bills || []).filter(b => {
      const docType = b.docType || b.doc_type || b.type || "";
      if (docType !== "Payment In") return false;
      const date = b.date || b.createdAt || b.created_at || "";
      return date.startsWith(today);
    }).map(b => ({
      ...b,
      displayAmount: Number(b.total || 0),
      displayName: b.customer || b.customer_name || b.customerName || b.party || "Walk-In",
      displayType: "Direct Payment In"
    }));

    return [...explicitPayments, ...directPayments].sort((a, b) => {
       const da = a.payment_date || a.created_at || a.date || "";
       const db = b.payment_date || b.created_at || b.date || "";
       return db.localeCompare(da);
    });
  }, [billPayments, bills]);
  
  const todayTotal = todayPayments.reduce((s, p) => s + p.displayAmount, 0);

  const fmtCur = n => `\u20b9${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  const daysDue = d => {
    if (!d) return "overdue";
    const diff = Math.floor((new Date() - new Date(d)) / 86400000);
    return diff > 0 ? `${diff}d overdue` : "due today";
  };
  /* The bill stores customer name as `bill.customer` per supabase schema */
  const getName    = b => b.customer || b.customer_name || b.customerName || b.party || "Unknown Party";

  const { overduePayments, severePayments } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const partyCredits = {};
    
    // 1. Calculate unallocated general credits per party
    // (Payment In, Sales Return, Credit Note stored in bills table)
    (bills || []).forEach(b => {
      const docType = b.docType || b.doc_type || b.type || "Sales Invoice";
      if (["Payment In", "Sales Return", "Credit Note"].includes(docType)) {
        const partyName = getName(b).toLowerCase().trim();
        const partyPhone = String(b.phone || "").replace(/\D/g, "");
        const key = partyPhone || partyName;
        if (!key) return;
        partyCredits[key] = (partyCredits[key] || 0) + Number(b.total || 0);
      }
    });

    // 2. Filter sales invoices and sort chronologically (oldest first for FIFO)
    const salesInvoices = (bills || []).filter(b => {
      const docType = b.docType || b.doc_type || b.type || "Sales Invoice";
      // Only check actual sales invoices that aren't marked explicitly paid
      return docType === "Sales Invoice" && b.status !== "paid";
    }).sort((a, b) => new Date(a.createdAt || a.date || a.created_at || 0) - new Date(b.createdAt || b.date || b.created_at || 0));

    const trulyOverdue = [];

    salesInvoices.forEach(b => {
      const due = b.due_date || b.dueDate;
      // If no valid due date, or not yet due, we don't show it in alerts
      if (!due || due >= today) return;

      const partyName = getName(b).toLowerCase().trim();
      const partyPhone = String(b.phone || "").replace(/\D/g, "");
      const key = partyPhone || partyName;

      // Base remaining ignores unallocated general credits, just specific bill_payments
      let { remaining } = getBillPaymentInfo(b, billPayments);
      
      // Apply unallocated credits (FIFO)
      if (key && partyCredits[key] > 0) {
        if (partyCredits[key] >= remaining) {
          partyCredits[key] -= remaining;
          remaining = 0;
        } else {
          remaining -= partyCredits[key];
          partyCredits[key] = 0;
        }
      }

      if (remaining > 0.01) {
        trulyOverdue.push({ ...b, calculated_remaining: remaining });
      }
    });

    const sortedOverdue = trulyOverdue.sort((a, b) => (a.due_date||a.dueDate||"").localeCompare(b.due_date||b.dueDate||""));
    
    const regular = [];
    const severe = [];
    sortedOverdue.forEach(b => {
      const d = b.due_date || b.dueDate;
      const diff = Math.floor((new Date() - new Date(d)) / 86400000);
      if (diff > 30) severe.push(b);
      else regular.push(b);
    });
    
    return { overduePayments: regular, severePayments: severe };
  }, [bills, billPayments]);
  
  const overdueTotal = overduePayments.reduce((s, b) => s + (b.calculated_remaining || 0), 0);
  const severeTotal = severePayments.reduce((s, b) => s + (b.calculated_remaining || 0), 0);
  const getPayee   = p => p.displayName || p.payee_name || p.customer || p.party_name || "Walk-In";

  const SectionHeader = ({ id, color, label, title, subtitle }) => (
    <div style={{ padding:"20px 26px 14px" }}>
      <div className="card-label" style={{ color }}>{label}</div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h2 style={{ margin:0, fontSize:"1.4rem", fontWeight:900, color:"#0f172a", letterSpacing:"-0.4px" }}>{title}</h2>
          <p style={{ margin:"4px 0 0", color:"#64748b", fontSize:"0.85rem", fontWeight:500 }}>{subtitle}</p>
        </div>
        <button className="section-toggle" onClick={() => toggleCollapse(id)}>
          {collapsed[id] ? "▶ Show" : "▼ Hide"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <style>{STYLE}</style>
      <div style={{ height:"calc(100vh - 70px)", background:"#f8f9fb", fontFamily:"'Inter', sans-serif", display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* Monkey Marquee */}
        <div className="monkey-bar">
          <marquee scrollamount="9">
            {[0,1,2].map(i => (
              <span key={i} style={{ display:"inline-flex", alignItems:"center", gap:14, marginRight:80 }}>
                <span className="monkey-emoji">🐒</span>
                <span className="bubble-text">DO FAST! DO FAST! DO FAST! 🔥</span>
                <span className="monkey-emoji" style={{ animationDelay:"0.27s" }}>💨</span>
              </span>
            ))}
          </marquee>
        </div>

        {/* 4 Cards Row */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:22, padding:"20px 28px 0", flex:1, minHeight:0 }}>

          {/* Out of Stock */}
          <div className="alert-card" style={{ animationDelay:"0s" }}>
            <SectionHeader id="stock" color="#9e3f4e" label="🚨 Needs Restocking" title="Out of Stock"
              subtitle={`${outOfStock.length} item${outOfStock.length !== 1 ? "s" : ""} at zero qty`} />
            <div style={{ height:1, background:"#f1f5f9", margin:"0 26px" }} />
            {!collapsed["stock"] && (
              <div style={{ flex:1, overflowY:"auto", padding:"14px 26px 20px" }}>
                {outOfStock.length === 0 ? (
                  <div className="empty-state"><span style={{ fontSize:"2.8rem" }}>✨</span><span style={{ fontWeight:700 }}>All stocked up!</span></div>
                ) : outOfStock.map((item, idx) => (
                  <div key={item.id || idx} className="alert-row" style={{ background: idx % 2 === 0 ? "#fffcfc" : "#fff", cursor: onNavigate ? "pointer" : "default" }} onClick={() => onNavigate && onNavigate("products")}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight:800, fontSize:"0.95rem", color:"#0f172a", display:"flex", alignItems:"center", gap:6 }}>
                        {item.name}
                        {onNavigate && <span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>View →</span>}
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:600, marginTop:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                        {item.category || "PRODUCT"}
                      </div>
                    </div>
                    <span className="pill-red">0 {item.unit || "PCS"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collected Today */}
          <div className="alert-card" style={{ animationDelay:"0.1s" }}>
            <SectionHeader id="income" color="#15803d" label="💰 Collected Today" title="Payments In"
              subtitle={<>Total: <strong style={{ color:"#15803d" }}>{fmtCur(todayTotal)}</strong></>} />
            <div style={{ height:1, background:"#f1f5f9", margin:"0 26px" }} />
            {!collapsed["income"] && (
              <div style={{ flex:1, overflowY:"auto", padding:"14px 26px 20px" }}>
                {todayPayments.length === 0 ? (
                  <div className="empty-state"><span style={{ fontSize:"2.8rem" }}>💤</span><span style={{ fontWeight:700 }}>No payments yet today</span></div>
                ) : todayPayments.map((pay, idx) => (
                  <div key={pay.id || idx} className="alert-row" style={{ background: idx % 2 === 0 ? "#f0fdf4" : "#fff", cursor: onViewCustomer ? "pointer" : "default" }} onClick={() => onViewCustomer && onViewCustomer({ name: getPayee(pay), phone: pay.phone })}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:"0.95rem", color:"#0f172a", display:"flex", alignItems:"center", gap:6 }}>
                        {getPayee(pay)}
                        {onViewCustomer && <span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>View →</span>}
                      </div>
                      <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                        <span className="pill-mode">{pay.payment_mode || pay.method || pay.mode || "CASH"}</span>
                        {pay.displayType === "Direct Payment In" && <span style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:600 }}>Direct Payment</span>}
                        {pay.note && <span style={{ fontSize:"0.72rem", color:"#94a3b8", fontWeight:600 }}>{pay.note}</span>}
                      </div>
                    </div>
                    <div style={{ fontWeight:900, fontSize:"1.2rem", color:"#15803d", letterSpacing:"-0.5px" }}>
                      +{fmtCur(pay.displayAmount)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue */}
          <div className="alert-card" style={{ animationDelay:"0.2s" }}>
            <SectionHeader id="overdue" color="#c2410c" label="⏰ Pending Collection" title="Overdue"
              subtitle={<>Pending: <strong style={{ color:"#c2410c" }}>{fmtCur(overdueTotal)}</strong></>} />
            <div style={{ height:1, background:"#f1f5f9", margin:"0 26px" }} />
            {!collapsed["overdue"] && (
              <div style={{ flex:1, overflowY:"auto", padding:"14px 26px 20px" }}>
                {overduePayments.length === 0 ? (
                  <div className="empty-state"><span style={{ fontSize:"2.8rem" }}>🎉</span><span style={{ fontWeight:700 }}>No overdue payments!</span></div>
                ) : overduePayments.map((bill, idx) => {
                  const isImp = !!important[bill.id];
                  return (
                    <div key={bill.id || idx} className={`alert-row${isImp ? " important-row" : ""}`}
                      style={{ background: isImp ? undefined : (idx % 2 === 0 ? "#fff7ed" : "#fff"), cursor: onViewCustomer ? "pointer" : "default" }}
                      onClick={() => onViewCustomer && onViewCustomer({ name: getName(bill), phone: bill.phone })}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:"0.95rem", color:"#0f172a", display:"flex", alignItems:"center", gap:6 }}>
                          {getName(bill)}
                          {isImp && (
                            <span style={{ fontSize:"0.68rem", background:"#fef3c7", color:"#92400e", padding:"2px 7px", borderRadius:6, fontWeight:700 }}>
                              TODAY ⭐
                            </span>
                          )}
                          {onViewCustomer && (
                            <span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>View →</span>
                          )}
                        </div>
                        <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                          <span className="pill-orange">{daysDue(bill.due_date || bill.dueDate)}</span>
                          {bill.phone && (
                            <span style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600 }}>📞 {bill.phone}</span>
                          )}
                          {bill.bill_number && (
                            <span style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{bill.bill_number}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontWeight:900, fontSize:"1.15rem", color:"#c2410c", letterSpacing:"-0.5px" }}>
                          {fmtCur(bill.calculated_remaining)}
                        </div>
                        <button
                          className={`star-btn${isImp ? " starred" : ""}`}
                          title={isImp ? "Remove from today's list" : "Mark important for today"}
                          onClick={e => { e.stopPropagation(); toggleImportant(bill.id); }}>
                          {isImp ? "⭐" : "☆"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Critical Overdue (> 30 Days) */}
          <div className="alert-card" style={{ animationDelay:"0.3s", border: "2px solid #fee2e2" }}>
            <SectionHeader id="severe" color="#ef4444" label="🚨 HIGH PRIORITY" title="Critical Overdue"
              subtitle={<>
                {severeTotal > 0 && <span style={{marginRight:8}}>Pending: <strong style={{ color:"#ef4444" }}>{fmtCur(severeTotal)}</strong></span>}
                {overdueTasks.length > 0 && <span>Tasks: <strong style={{ color:"#ef4444" }}>{overdueTasks.length}</strong></span>}
                {severeTotal === 0 && overdueTasks.length === 0 && "Pending: ₹0.00"}
              </>} />
            <div style={{ height:1, background:"#f1f5f9", margin:"0 26px" }} />
            {!collapsed["severe"] && (
              <div style={{ flex:1, overflowY:"auto", padding:"14px 26px 20px" }}>
                {severePayments.length === 0 && overdueTasks.length === 0 ? (
                  <div className="empty-state"><span style={{ fontSize:"2.8rem" }}>🙌</span><span style={{ fontWeight:700 }}>No critical overdues!</span></div>
                ) : (
                  <>
                  {overdueTasks.map((task, idx) => (
                    <div key={`task-${task.id || idx}`} className="alert-row important-row" style={{ background: "#fef2f2", cursor: onNavigate ? "pointer" : "default" }} onClick={() => onNavigate && onNavigate("tasks")}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight:800, fontSize:"0.95rem", color:"#0f172a", display:"flex", alignItems:"center", gap:6 }}>
                          {task.title}
                          <span style={{ fontSize:"0.68rem", background:"#fef3c7", color:"#92400e", padding:"2px 7px", borderRadius:6, fontWeight:700 }}>
                            TASK
                          </span>
                          {onNavigate && <span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>View →</span>}
                        </div>
                        <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                          <span className="pill-orange" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>Overdue</span>
                          {task.customer && <span style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600 }}>👤 {task.customer}</span>}
                          {task.deadline && <span style={{ fontSize:"0.7rem", color:"#94a3b8" }}>Due: {new Date(task.deadline).toLocaleDateString('en-IN', {month:'short', day:'numeric'})}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {severePayments.map((bill, idx) => {
                    const isImp = !!important[bill.id];
                    return (
                    <div key={bill.id || idx} className={`alert-row${isImp ? " important-row" : ""}`}
                      style={{ background: isImp ? undefined : (idx % 2 === 0 ? "#fef2f2" : "#fff"), cursor: onViewCustomer ? "pointer" : "default" }}
                      onClick={() => onViewCustomer && onViewCustomer({ name: getName(bill), phone: bill.phone })}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:"0.95rem", color:"#0f172a", display:"flex", alignItems:"center", gap:6 }}>
                          {getName(bill)}
                          {isImp && (
                            <span style={{ fontSize:"0.68rem", background:"#fef3c7", color:"#92400e", padding:"2px 7px", borderRadius:6, fontWeight:700 }}>
                              TODAY ⭐
                            </span>
                          )}
                          {onViewCustomer && (
                            <span style={{ fontSize:"0.68rem", color:"#94a3b8", fontWeight:600, marginLeft:"auto" }}>View →</span>
                          )}
                        </div>
                        <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                          <span className="pill-orange" style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}>{daysDue(bill.due_date || bill.dueDate)}</span>
                          {bill.phone && (
                            <span style={{ fontSize:"0.72rem", color:"#64748b", fontWeight:600 }}>📞 {bill.phone}</span>
                          )}
                          {bill.bill_number && (
                            <span style={{ fontSize:"0.7rem", color:"#94a3b8" }}>{bill.bill_number}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontWeight:900, fontSize:"1.15rem", color:"#b91c1c", letterSpacing:"-0.5px" }}>
                          {fmtCur(bill.calculated_remaining)}
                        </div>
                        <button
                          className={`star-btn${isImp ? " starred" : ""}`}
                          onClick={(e) => { e.stopPropagation(); toggleImportant(bill.id); }}
                          title="Mark for today"
                        >
                          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27l4.15 2.51c.76.46 1.69-.22 1.49-1.08l-1.1-4.72 3.67-3.18c.67-.58.31-1.68-.57-1.75l-4.83-.41-1.89-4.46c-.34-.81-1.5-.81-1.84 0L9.19 8.63l-4.83.41c-.88.07-1.24 1.17-.57 1.75l3.67 3.18-1.1 4.72c-.2.86.73 1.54 1.49 1.08l4.15-2.5z"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                  </>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Quick Notes */}
        <div style={{ padding:"14px 28px 18px" }}>
          <div style={{ background:"#fff", borderRadius:18, boxShadow:"0 4px 16px rgba(0,112,243,0.08)", padding:"16px 24px", display:"flex", alignItems:"flex-start", gap:14 }}>
            <span style={{ fontSize:"1.4rem", marginTop:2 }}>📝</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"0.67rem", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#94a3b8", marginBottom:5 }}>Quick Notes</div>
              <textarea
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Type a note, reminder, or action item here..."
                rows={2}
                style={{ width:"100%", background:"transparent", border:"none", outline:"none", resize:"none", fontFamily:"'Inter',sans-serif", fontSize:"0.93rem", color:"#0f172a", lineHeight:1.7 }}
              />
            </div>
            {note && (
              <button onClick={() => setNote("")}
                style={{ background:"#f1f5f9", border:"none", borderRadius:10, padding:"5px 13px", cursor:"pointer", fontSize:"0.78rem", color:"#64748b", fontWeight:700 }}>
                Clear
              </button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
