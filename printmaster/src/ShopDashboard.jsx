/* eslint-disable react/prop-types */
import { getBillPaymentInfo } from "./billingUtils.js";

const fmtCur = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function Icon({ name, size = 16, color = "currentColor" }) {
  const icons = {
    payment: <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v4z" />,
    chart: <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />,
    billing: <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />,
    customers: <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />,
    plus: <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />,
    tasks: <path d="M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
      {icons[name] || null}
    </svg>
  );
}

export default function ShopDashboard({ bills, tasks, workers, vendors, billPayments, totalRevenue, totalPending, paidBills, unpaidBills, pendingTasks, completedTasks, setPage, brand, onViewInvoice, setAdvancedDraft }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const validBills = bills.filter(b => b.docType !== "Payment In");
  const overdueBills = validBills.filter(b => !getBillPaymentInfo(b, billPayments).isPaid && (b.dueDate || b.due_date) && (b.dueDate || b.due_date) < todayStr);
  const billsToday = validBills.filter(b => b.createdAt && b.createdAt.startsWith(todayStr));
  const todayBillsCount = billsToday.length;
  const todaySales = billsToday.reduce((s, b) => s + (b.total || 0), 0);
  const partialBills = validBills.filter(b => getBillPaymentInfo(b, billPayments).status === "Partially Paid");
  const methodTotals = (billPayments || []).reduce((acc, p) => { const m = (p.method || "cash").toLowerCase(); acc[m] = (acc[m] || 0) + (Number(p.amount) || 0); return acc; }, {});
  const workerStats = workers.map(w => ({ worker: w, completed: tasks.filter(t => (t.worker === w.id || t.worker_id === w.id) && t.status === "Completed").length })).sort((a, b) => b.completed - a.completed);
  const uniqueCustomers = validBills.reduce((set, b) => (b.customer ? set.add(b.customer) : set), new Set()).size;

  const monthlyRevenue = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString("en-IN", { month: "short" });
      const rev = validBills.filter(b => (b.createdAt || "").startsWith(key)).reduce((s, b) => s + (b.total || 0), 0);
      months.push({ label, rev });
    }
    return months;
  })();
  const maxRev = Math.max(...monthlyRevenue.map(m => m.rev), 1);

  const card = (icon, iconBg, iconColor, gradFrom, gradTo, badgeBg, badgeText, badgeLabel, value, label, sub) => (
    <div className="card" style={{ position: "relative", overflow: "hidden", paddingTop: 20, cursor: "default" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${gradFrom},${gradTo})` }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={18} color={iconColor} />
        </div>
        <span style={{ fontSize: ".68rem", fontWeight: 700, background: badgeBg, color: badgeText, padding: "3px 8px", borderRadius: 99 }}>{badgeLabel}</span>
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 900, fontFamily: "var(--mono)", color: "var(--text)", letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: ".78rem", color: "var(--text2)", marginTop: 4, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: ".68rem", color: "var(--text3)", marginTop: 2 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header + Quick Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 2 }}>Operational Control</div>
          <div style={{ fontSize: ".82rem", color: "var(--text2)" }}>Real-time oversight of {brand.shopName}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage("payments")}><Icon name="payment" size={14} />Record Payment</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setPage("customers")}><Icon name="customers" size={14} />Add Customer</button>
          <button className="btn btn-primary btn-sm" onClick={() => {
            if (brand?.defaultBillingMethod === "classic") {
              setPage("billing");
            } else {
              setAdvancedDraft({ docType: "Tax Invoice (GST)" });
            }
          }}><Icon name="plus" size={14} />New Invoice</button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
        {card("payment", "#eff6ff", "#2563eb", "#2563eb", "#4f46e5", "#dcfce7", "#166534", `${paidBills.length} paid`, fmtCur(totalRevenue), "Total Revenue", `${paidBills.length} paid bills`)}
        {card("chart", "#fef2f2", "#ef4444", "#ef4444", "#ea580c", "#fee2e2", "#991b1b", `${unpaidBills.length + partialBills.length} Unpaid`, fmtCur(totalPending), "Pending Dues", `${overdueBills.length} overdue`)}
        {card("billing", "#f0fdf4", "#10b981", "#10b981", "#059669", "#dcfce7", "#166534", "Daily Goal", todayBillsCount, "Today's Bills", `${fmtCur(todaySales)} today`)}
        {card("customers", "#f5f3ff", "#8b5cf6", "#8b5cf6", "#6d28d9", "#ede9fe", "#5b21b6", "Active", uniqueCustomers, "Total Customers", "From all bills")}
      </div>

      {/* Recent Bills + Revenue Chart */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)", gap: 16, marginBottom: 16, alignItems: "start" }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: ".9rem", color: "var(--text)" }}>Recent Transactions</div>
            <button className="btn btn-sm btn-ghost" style={{ fontSize: ".72rem" }} onClick={() => setPage("billing")}>View All Ledger →</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {validBills.slice(0, 7).map(b => {
                  const info = getBillPaymentInfo(b, billPayments);
                  const bc = info.isPaid ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red";
                  return (
                    <tr key={b.id} onClick={() => typeof onViewInvoice === 'function' && onViewInvoice(b.id)} style={{ cursor: "pointer" }}>
                      <td style={{ fontFamily: "var(--mono)", fontSize: ".75rem", color: "var(--accent)", fontWeight: 700 }}>{b.id}</td>
                      <td style={{ fontWeight: 600, fontSize: ".82rem" }}>{b.customer || "—"}</td>
                      <td style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: ".82rem" }}>{fmtCur(b.total)}</td>
                      <td><span className={`badge ${bc}`}>{info.status}</span></td>
                      <td style={{ fontSize: ".72rem", color: "var(--text3)" }}>{fmtDate(b.createdAt)}</td>
                    </tr>
                  );
                })}
                {validBills.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>No bills yet. Create your first invoice!</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: ".9rem", color: "var(--text)", marginBottom: 20 }}>Revenue Trends</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110, marginBottom: 8 }}>
            {monthlyRevenue.map((m, i) => {
              const pct = maxRev > 0 ? (m.rev / maxRev) * 100 : 0;
              const isLast = i === monthlyRevenue.length - 1;
              return (
                <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }} title={`${m.label}: ${fmtCur(m.rev)}`}>
                  <div style={{ width: "100%", borderRadius: "4px 4px 0 0", minHeight: 4, height: `${Math.max(pct, 4)}%`, background: isLast ? "linear-gradient(to top,#ea580c,#f97316)" : "linear-gradient(to top,#2563eb,#4f46e5)", transition: "height .4s ease", opacity: isLast ? 1 : 0.65 }} />
                  <div style={{ fontSize: ".6rem", color: "var(--text3)", fontWeight: 600 }}>{m.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: ".7rem", color: "var(--text3)", fontWeight: 700, marginBottom: 4 }}>6-MONTH TREND</div>
            <div style={{ fontWeight: 800, color: "#ea580c", fontSize: ".9rem" }}>
              {validBills.filter(b => (b.createdAt || "").startsWith(new Date().toISOString().slice(0, 7))).length} bills this month
            </div>
          </div>
          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 700, color: "var(--text3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>Payment Split</div>
            {Object.keys(methodTotals).length === 0
              ? <div style={{ fontSize: ".75rem", color: "var(--text3)" }}>No payments yet</div>
              : Object.entries(methodTotals).map(([m, v]) => (
                <div key={m} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: ".75rem", color: "var(--text2)", textTransform: "capitalize" }}>{m}</div>
                  <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: ".78rem", color: "var(--accent)" }}>{fmtCur(v)}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Workers + Recent Tasks */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: ".9rem" }}>Worker Performance</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Worker</th><th>Tasks Completed</th></tr></thead>
              <tbody>
                {workerStats.slice(0, 5).map(({ worker, completed }) => (
                  <tr key={worker.id}>
                    <td style={{ fontWeight: 600 }}>{worker.name}</td>
                    <td style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--accent)" }}>{completed}</td>
                  </tr>
                ))}
                {workerStats.length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>No workers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: ".9rem" }}>Recent Tasks</div>
            <button className="btn btn-sm btn-ghost" style={{ fontSize: ".72rem" }} onClick={() => setPage("tasks")}>View all</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Task</th><th>Worker</th><th>Status</th></tr></thead>
              <tbody>
                {tasks.slice(0, 5).map(t => {
                  const sc = t.status === "Completed" ? "badge-green" : t.status === "In Progress" ? "badge-blue" : "badge-yellow";
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600, fontSize: ".82rem" }}>{t.title}</td>
                      <td style={{ fontSize: ".75rem", color: "var(--text2)" }}>{t.worker ? (workers.find(w => w.id === t.worker)?.name || t.worker) : (vendors?.find(v => v.id === t.vendor)?.name || t.vendor || "—")}</td>
                      <td><span className={`badge ${sc}`}>{t.status}</span></td>
                    </tr>
                  );
                })}
                {tasks.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>No tasks yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
