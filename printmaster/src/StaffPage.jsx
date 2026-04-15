import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './supabase.js';

const P_TYPES = ["Monthly", "Weekly", "Daily", "Piece Rate"];
const CYCLES = ["1 to 1 Every month", "1 to 31 Every month", "15 to 15 Every month", "Weekly Monday"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const ATT_COLORS = {
  P:  { bg: "#10b981", label: "Present" },
  A:  { bg: "#ef4444", label: "Absent" },
  HD: { bg: "#f59e0b", label: "Half Day" },
  PL: { bg: "#4f67ff", label: "Paid Leave" },
  WO: { bg: "#94a3b8", label: "Week Off" },
};

/* ─── Premium Circle Attendance Button ─── */
function AttBtn({ code, active, onClick }) {
  const [tip, setTip] = useState(false);
  const timer = React.useRef(null);
  const { bg, label } = ATT_COLORS[code];
  return (
    <span style={{ position:"relative", display:"inline-block" }}
      onMouseEnter={()=>setTip(true)} onMouseLeave={()=>setTip(false)}
      onTouchStart={()=>{ timer.current=setTimeout(()=>setTip(true),350); }}
      onTouchEnd={()=>{ clearTimeout(timer.current); setTip(false); }}
    >
      <button onClick={onClick} style={{
        width:32, height:32, borderRadius:"50%",
        border: active ? "none" : "1.5px solid #e2e8f0",
        background: active ? `linear-gradient(135deg,${bg},${bg}cc)` : "#fff",
        color: active ? "#fff" : "#94a3b8",
        fontSize:".72rem", fontWeight:700,
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow: active ? `0 2px 8px ${bg}55` : "none",
        transition:"all .15s ease",
        flexShrink:0,
      }}>
        {code}
      </button>
      {tip && (
        <div style={{
          position:"absolute", bottom:"calc(100% + 7px)", left:"50%",
          transform:"translateX(-50%)", background:"#1e293b", color:"#fff",
          fontSize:".7rem", fontWeight:600, padding:"4px 10px",
          borderRadius:6, whiteSpace:"nowrap", zIndex:1000,
          pointerEvents:"none", boxShadow:"0 2px 8px rgba(0,0,0,.25)"
        }}>
          {label}
          <div style={{
            position:"absolute", top:"100%", left:"50%", transform:"translateX(-50%)",
            width:0, height:0, borderLeft:"5px solid transparent",
            borderRight:"5px solid transparent", borderTop:"5px solid #1e293b"
          }}/>
        </div>
      )}
    </span>
  );
}

const Icon = ({ name, size=16 }) => {
  if(name==="plus") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
  if(name==="chevron-left") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
  if(name==="chevron-right") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
  if(name==="check") return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
  return null;
};

/* ─── Avatar circle ─── */
function Avatar({ name, size=48, fontSize="1.2rem" }) {
  const colors = ["#4f67ff","#7c3aed","#0891b2","#059669","#d97706","#dc2626"];
  const color = colors[(name||"").charCodeAt(0) % colors.length];
  return (
    <div style={{
      width:size, height:size, borderRadius:"50%",
      background:`linear-gradient(135deg,${color},${color}99)`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize, fontWeight:700, color:"#fff", flexShrink:0,
      boxShadow:`0 4px 14px ${color}44`, userSelect:"none",
    }}>
      {(name||"?")[0].toUpperCase()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE — Staff List
═══════════════════════════════════════════════════ */
export default function StaffPage({ workers, vendors, setWorkers, tasks, showToast, user }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [editPassModal, setEditPassModal] = useState(null);
  const [newPass, setNewPass] = useState("");
  const [form, setForm] = useState({
    name:"", username:"", password:"", phone:"",
    salaryType:"Monthly", salaryAmount:"0", salaryCycle:"1 to 1 Every month", openingBalance:"0"
  });
  const [processingPayroll, setProcessingPayroll] = useState(false);

  const handleBulkPayroll = async () => {
    const monthlyStaff = workers.filter(w => w.salary_type === "Monthly" && w.salary_amount > 0);
    if(monthlyStaff.length === 0) return showToast("No monthly staff found with a valid salary amount.", "error");
    if(!window.confirm(`Generate automated payroll for ${monthlyStaff.length} Monthly staff members?`)) return;
    
    showToast("Processing bulk payroll...", "info");
    setProcessingPayroll(true);
    let count = 0;
    for (const w of monthlyStaff) {
      const payload = { 
         workerId: w.id, 
         organisationId: user?.organisationId, 
         type: "Salary", 
         amount: Number(w.salary_amount), 
         note: `Automated Payroll - ${new Date().toLocaleString('en-US',{month:'long',year:'numeric'})}` 
      };
      await db.addWorkerTransaction(payload);
      count++;
    }
    setProcessingPayroll(false);
    showToast(`Success! Payroll generated for ${count} staff members.`, "success");
  };

  const add = async () => {
    if(user?.organisationPlan==="free" && (workers.length+(vendors?.length||0))>=3)
      return showToast("Free plan limit: Max 3 Vendors & Workers combined. Upgrade to Pro.","error");
    if(!form.name||!form.username||!form.password) return showToast("All required fields must be filled","error");
    if(workers.find(w=>w.username===form.username)) return showToast("Username already taken","error");
    const payload = { role:"worker", ...form, salaryAmount:Number(form.salaryAmount)||0, openingBalance:Number(form.openingBalance)||0, organisationId:user?.organisationId };
    showToast("Saving...","info");
    const saved = await db.addWorker(payload);
    if(saved) { setWorkers(w=>[...w,saved]); showToast("Staff member added successfully"); }
    else { setWorkers(w=>[...w,{id:"local-"+Date.now(),...payload}]); showToast("Saved locally","error"); }
    setShowModal(false);
    setForm({name:"",username:"",password:"",phone:"",salaryType:"Monthly",salaryAmount:"0",salaryCycle:"1 to 1 Every month",openingBalance:"0"});
  };

  const removeWorker = async (id) => {
    // Task 3.3 – check DB response before touching local state
    const err = await db.deleteWorker(id);
    if (err) {
      showToast("Failed to remove staff: " + (err.message || "Unknown error"), "error");
      return;
    }
    setWorkers(ws => ws.filter(x => x.id !== id));
    if (selectedStaff?.id === id) setSelectedStaff(null);
    showToast("Removed");
  };

  const changePass = async () => {
    if(!newPass||newPass.length<4) return showToast("Password must be at least 4 characters","error");
    const updated = {...editPassModal, password:newPass};
    await db.updateWorkerPassword(updated.id, newPass);
    setWorkers(ws=>ws.map(w=>w.id===updated.id?updated:w));
    setEditPassModal(null); setNewPass("");
    showToast("Password updated!");
  };

  if(selectedStaff) {
    return <StaffProfile staff={selectedStaff} onBack={()=>setSelectedStaff(null)} showToast={showToast} organisationId={user?.organisationId} />;
  }

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9fa" }}>

      {/* ── Page Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
        <div>
          <h2 style={{ margin:0, fontSize:"1.5rem", fontWeight:700, letterSpacing:"-0.01em", color:"#1a1c1c" }}>
            Personnel Directory
          </h2>
          <div style={{ fontSize:".875rem", color:"#888", marginTop:4, letterSpacing:"-0.01em" }}>
            Manage employee profiles, payroll schedules, and attendance
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{
            background:"#dcfce7", color:"#166534",
            fontSize:".72rem", fontWeight:700, letterSpacing:"0.04em",
            padding:"5px 12px", borderRadius:999,
            display:"flex", alignItems:"center", gap:5
          }}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#16a34a",display:"inline-block"}}/>
            {workers.length} ACTIVE STAFF
          </div>
          <button onClick={()=>setShowModal(true)} style={{
            background:"#4f67ff", color:"#fff", border:"none",
            borderRadius:999, padding:"9px 18px", fontSize:".875rem", fontWeight:600,
            cursor:"pointer", display:"flex", alignItems:"center", gap:6,
            boxShadow:"0 2px 12px #4f67ff44", letterSpacing:"-0.01em",
            transition:"all .15s"
          }}>
            <Icon name="plus" size={14}/> Add Staff
          </button>
        </div>
      </div>

      {/* ── Staff Cards Grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
        {workers.map(w => {
          const completed = (tasks||[]).filter(t=>(t.worker===w.id||t.worker_id===w.id)&&t.status==="Completed").length;
          const colors = ["#4f67ff","#7c3aed","#0891b2","#059669","#d97706","#dc2626"];
          const color = colors[(w.name||"").charCodeAt(0)%colors.length];
          return (
            <div key={w.id} onClick={()=>setSelectedStaff(w)}
              style={{
                background:"#fff", borderRadius:16, overflow:"hidden",
                boxShadow:"0 2px 12px rgba(0,0,0,0.06)",
                cursor:"pointer", transition:"box-shadow .2s, transform .15s",
                display:"flex", flexDirection:"column",
              }}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,0.12)";e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)";e.currentTarget.style.transform="";}}
            >
              {/* Color accent top bar */}
              <div style={{ height:4, background:`linear-gradient(90deg,${color},${color}88)` }}/>

              <div style={{ padding:"20px 20px 0", display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                <Avatar name={w.name} size={60} fontSize="1.4rem" />
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontWeight:700, fontSize:"1.05rem", letterSpacing:"-0.01em", color:"#1a1c1c" }}>{w.name}</div>
                  <div style={{ fontSize:".8rem", color:"#94a3b8", marginTop:2 }}>Login ID: <span style={{color:"#4f67ff", fontWeight:600}}>{w.username}</span></div>
                  <div style={{ fontSize:".65rem", color:"#cbd5e1", marginTop:4, fontFamily:"monospace" }}>ID: {w.id}</div>
                </div>
              </div>

              {/* Stats strip */}
              <div style={{ display:"flex", margin:"16px 20px 0", borderRadius:10, overflow:"hidden", background:"#f8f9fa", fontSize:".8rem" }}>
                <div style={{ flex:1, padding:"8px 0", textAlign:"center" }}>
                  <div style={{ color:"#94a3b8", fontSize:".7rem", marginBottom:2 }}>TYPE</div>
                  <div style={{ fontWeight:600, color:"#1a1c1c" }}>{w.salary_type||"Monthly"}</div>
                </div>
                <div style={{ flex:1, padding:"8px 0", textAlign:"center", borderLeft:"1px solid #e8e8e8", borderRight:"1px solid #e8e8e8" }}>
                  <div style={{ color:"#94a3b8", fontSize:".7rem", marginBottom:2 }}>SALARY</div>
                  <div style={{ fontWeight:600, color:"#1a1c1c" }}>₹{(w.salary_amount||0).toLocaleString()}</div>
                </div>
                <div style={{ flex:1, padding:"8px 0", textAlign:"center" }}>
                  <div style={{ color:"#94a3b8", fontSize:".7rem", marginBottom:2 }}>TASKS ✓</div>
                  <div style={{ fontWeight:600, color:"#10b981" }}>{completed}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display:"flex", gap:8, padding:"14px 20px 20px" }} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>{setEditPassModal(w);setNewPass("");}} style={{
                  flex:1, padding:"7px 0", background:"transparent", border:"1.5px solid #e2e8f0",
                  borderRadius:999, fontSize:".8rem", fontWeight:600, cursor:"pointer", color:"#444",
                  transition:"background .15s"
                }}>🔑 Password</button>
                <button onClick={()=>removeWorker(w.id)} style={{
                  width:34, height:34, borderRadius:"50%", background:"#fff0f0",
                  border:"1.5px solid #fecaca", color:"#ef4444",
                  fontSize:".9rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center"
                }}>✕</button>
              </div>
            </div>
          );
        })}

        {workers.length === 0 && (
          <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"60px 20px", color:"#94a3b8" }}>
            <div style={{ fontSize:"2rem", marginBottom:8 }}>👥</div>
            <div style={{ fontWeight:600, marginBottom:4 }}>No staff members yet</div>
            <div style={{ fontSize:".875rem" }}>Click "Add Staff" to get started</div>
          </div>
        )}
      </div>

      {/* ── Upcoming Payroll Section ── */}
      {workers.length > 0 && (
        <div style={{ marginTop:24, background:"#fff", borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:"1rem", color:"#1a1c1c", letterSpacing:"-0.01em" }}>Upcoming Payroll</div>
              <div style={{ fontSize:".8rem", color:"#94a3b8", marginTop:2 }}>Next cycle due end of month</div>
            </div>
            <button onClick={handleBulkPayroll} disabled={processingPayroll} style={{
              background:"linear-gradient(135deg, #10b981, #059669)", color:"#fff",
              border:"none", borderRadius:999, padding:"8px 16px", fontSize:".85rem",
              fontWeight:700, cursor:processingPayroll?"not-allowed":"pointer", opacity:processingPayroll?0.7:1,
              boxShadow:"0 4px 12px rgba(16,185,129,0.3)"
            }}>
              {processingPayroll ? "Processing..." : "⚡ Generate Monthly Payroll"}
            </button>
          </div>
          <div style={{ display:"flex", gap:12 }}>
            {[
              { label:"Total Liability", value:`₹${workers.reduce((s,w)=>s+(w.salary_amount||0),0).toLocaleString()}`, color:"#4f67ff" },
              { label:"Staff Count", value:`${workers.length} Members`, color:"#10b981" },
              { label:"This Month", value:new Date().toLocaleString('en-US',{month:'long',year:'numeric'}), color:"#f59e0b" },
            ].map(s=>(
              <div key={s.label} style={{ flex:1, background:"#f8f9fa", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:".72rem", color:"#94a3b8", fontWeight:600, letterSpacing:"0.04em", marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:"1.1rem", fontWeight:700, color:s.color, letterSpacing:"-0.01em" }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Staff Modal ── */}
      {showModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, width:"min(560px,95vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:"1.1rem", fontWeight:700, letterSpacing:"-0.01em", color:"#1a1c1c" }}>Add New Staff Member</div>
              <button onClick={()=>setShowModal(false)} style={{ width:32,height:32,borderRadius:"50%",border:"1.5px solid #e2e8f0",background:"transparent",cursor:"pointer",color:"#888",fontSize:"1rem" }}>×</button>
            </div>
            <div style={{ height:1, background:"#f1f5f9", marginBottom:20 }}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {[
                { label:"STAFF NAME *", field:"name", placeholder:"e.g. Rahul Kumar", full:true },
                { label:"MOBILE NUMBER", field:"phone", placeholder:"+91 98765 43210" },
                { label:"USERNAME *", field:"username", placeholder:"rahul123" },
                { label:"PASSWORD *", field:"password", placeholder:"••••••", type:"password" },
              ].map(f=>(
                <div key={f.field} style={{ gridColumn:f.full?"1/-1":"auto" }}>
                  <div style={{ fontSize:".7rem", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em", marginBottom:6 }}>{f.label}</div>
                  <input type={f.type||"text"} value={form[f.field]} onChange={e=>setForm({...form,[f.field]:e.target.value})} placeholder={f.placeholder}
                    style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid #e2e8f0", padding:"8px 0", fontSize:".95rem", color:"#1a1c1c", outline:"none", boxSizing:"border-box" }}
                    onFocus={e=>e.target.style.borderBottomColor="#4f67ff"}
                    onBlur={e=>e.target.style.borderBottomColor="#e2e8f0"}
                  />
                </div>
              ))}
              <div>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em", marginBottom:6 }}>SALARY AMOUNT (₹)</div>
                <input type="number" value={form.salaryAmount} onChange={e=>setForm({...form,salaryAmount:e.target.value})} placeholder="20000"
                  style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid #e2e8f0", padding:"8px 0", fontSize:".95rem", color:"#1a1c1c", outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderBottomColor="#4f67ff"}
                  onBlur={e=>e.target.style.borderBottomColor="#e2e8f0"}
                />
              </div>
              <div>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em", marginBottom:6 }}>OPENING BALANCE (₹)</div>
                <input type="number" value={form.openingBalance} onChange={e=>setForm({...form,openingBalance:e.target.value})} placeholder="0"
                  style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid #e2e8f0", padding:"8px 0", fontSize:".95rem", color:"#1a1c1c", outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderBottomColor="#4f67ff"}
                  onBlur={e=>e.target.style.borderBottomColor="#e2e8f0"}
                />
              </div>
            </div>
            {/* Salary type pill toggle */}
            <div style={{ marginTop:18 }}>
              <div style={{ fontSize:".7rem", fontWeight:700, color:"#94a3b8", letterSpacing:"0.04em", marginBottom:8 }}>SALARY TYPE</div>
              <div style={{ display:"flex", background:"#f1f5f9", borderRadius:999, padding:3, gap:3 }}>
                {P_TYPES.map(t=>(
                  <button key={t} onClick={()=>setForm({...form,salaryType:t})} style={{
                    flex:1, padding:"7px 0", borderRadius:999, border:"none", cursor:"pointer",
                    background:form.salaryType===t?"#4f67ff":"transparent",
                    color:form.salaryType===t?"#fff":"#666",
                    fontWeight:600, fontSize:".8rem", transition:"all .15s"
                  }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ height:1, background:"#f1f5f9", margin:"20px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <button onClick={()=>setShowModal(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#888", fontWeight:600, fontSize:".9rem" }}>Cancel</button>
              <button onClick={add} style={{ background:"#4f67ff", color:"#fff", border:"none", borderRadius:999, padding:"10px 24px", fontSize:".9rem", fontWeight:700, cursor:"pointer", boxShadow:"0 2px 12px #4f67ff44" }}>
                + Add Staff Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Password Modal ── */}
      {editPassModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&(setEditPassModal(null),setNewPass(""))}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, width:"min(400px,95vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize:"1.1rem", fontWeight:700, marginBottom:4 }}>Change Password</div>
            <div style={{ fontSize:".85rem", color:"#94a3b8", marginBottom:20 }}>{editPassModal.name}</div>
            <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="New password" autoFocus
              style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid #e2e8f0", padding:"10px 0", fontSize:"1rem", outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderBottomColor="#4f67ff"}
              onBlur={e=>e.target.style.borderBottomColor="#e2e8f0"}
            />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
              <button onClick={()=>{setEditPassModal(null);setNewPass("");}} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#888", fontWeight:600 }}>Cancel</button>
              <button onClick={changePass} style={{ background:"#4f67ff", color:"#fff", border:"none", borderRadius:999, padding:"9px 22px", fontWeight:700, cursor:"pointer" }}>Save Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   STAFF PROFILE — Attendance + Payroll
═══════════════════════════════════════════════════ */
function StaffProfile({ staff, onBack, showToast, organisationId }) {
  const [activeTab, setActiveTab] = useState("attendance");
  const [attendance, setAttendance] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear]   = useState(new Date().getFullYear());
  const [paymentModal, setPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm]   = useState({ amount:"", type:"Payment", note:"" });
  const [slipModal, setSlipModal]       = useState(false);
  const [isLoading, setIsLoading]       = useState(false); // Task 4.4 – loading indicator

  useEffect(() => { loadData(); }, [staff.id]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const att = await db.getWorkerAttendance(staff.id);
      const txn = await db.getWorkerTransactions(staff.id);
      setAttendance(att); setTransactions(txn);
    } finally {
      setIsLoading(false);
    }
  };

  const days = new Date(year, month+1, 0).getDate();

  const currentMonthAttendance = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      const d = new Date(a.date);
      if(d.getMonth()===month && d.getFullYear()===year) map[d.getDate()] = a.status;
    });
    return map;
  }, [attendance, month, year]);

  const stats = useMemo(() => {
    let p=0,a=0,hd=0,pl=0,wo=0;
    Object.values(currentMonthAttendance).forEach(v=>{
      if(v==="P") p++; if(v==="A") a++;
      if(v==="HD") hd++; if(v==="PL") pl++; if(v==="WO") wo++;
    });
    return {p,a,hd,pl,wo};
  }, [currentMonthAttendance]);

  // Task 5.3 – useCallback: stable references for handlers passed to O(days)
  // calendar cells — prevents each cell re-rendering on every parent state change.
  const setStatus = useCallback(async (day, status) => {
    const dt = new Date(year, month, day);
    const dateStr = [dt.getFullYear(), String(dt.getMonth()+1).padStart(2,"0"), String(dt.getDate()).padStart(2,"0")].join("-");
    const update = { worker_id:staff.id, organisation_id:organisationId, date:dateStr, status };
    setAttendance(prev => [...prev.filter(a=>a.date!==dateStr), update]);
    await db.upsertWorkerAttendance([update]);
  }, [year, month, staff.id, organisationId]);

  const prevMonth = useCallback(() => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }, [month]);
  const nextMonth = useCallback(() => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }, [month]);

  const runningBalance = useMemo(() => {
    let bal = Number(staff.opening_balance||0);
    transactions.forEach(t=>{
      if(t.type==="Salary") bal += Number(t.amount);
      if(["Advance","Payment","Deduction"].includes(t.type)) bal -= Number(t.amount);
    });
    return bal;
  }, [transactions, staff.opening_balance]);

  const handleApplyTransaction = async () => {
    const amt = Number(paymentForm.amount);
    if(!amt || isNaN(amt) || amt <= 0) return showToast("Enter a valid positive amount", "error");
    if(paymentForm.type === "Advance") {
      if(!window.confirm(`Warning: Issuing an Advance of ₹${amt} will increase the outstanding amount owed by the staff. Proceed?`)) return;
    }
    const payload = { workerId:staff.id, organisationId, type:paymentForm.type, amount:amt, note:paymentForm.note };
    showToast("Saving...","info");
    const tx = await db.addWorkerTransaction(payload);
    if(tx) { setTransactions([tx,...transactions]); setPaymentModal(false); setPaymentForm({amount:"",type:"Payment",note:""}); showToast("Transaction saved"); }
    else showToast("Failed to save transaction","error");
  };

  const colors = ["#4f67ff","#7c3aed","#0891b2","#059669","#d97706","#dc2626"];
  const avatarColor = colors[(staff.name||"").charCodeAt(0)%colors.length];

  return (
    <div style={{ minHeight:"100vh", background:"#f8f9fa" }}>
      {/* Task 4.4 – Loading skeleton while attendance/transactions fetch */}
      {isLoading && (
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", minHeight:200 }}>
          <div style={{
            width:40, height:40, borderRadius:"50%",
            border:"3px solid #e5e7eb", borderTopColor:"#4f46e5",
            animation:"spin 0.8s linear infinite"
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Profile Header ── */}
      <div style={{ background:"#fff", borderRadius:16, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16 }}>
          <button onClick={onBack} style={{
            width:36, height:36, borderRadius:"50%", border:"1.5px solid #e2e8f0",
            background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#666"
          }}><Icon name="chevron-left" size={18}/></button>

          {/* Avatar */}
          <div style={{
            width:60, height:60, borderRadius:"50%",
            background:`linear-gradient(135deg,${avatarColor},${avatarColor}99)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:"1.5rem", fontWeight:700, color:"#fff", flexShrink:0,
            boxShadow:`0 4px 14px ${avatarColor}44`, position:"relative"
          }}>
            {staff.name[0]?.toUpperCase()}
            <div style={{ position:"absolute", bottom:2, right:2, width:12, height:12, borderRadius:"50%", background:"#10b981", border:"2px solid #fff" }}/>
          </div>

          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:"1.1rem", letterSpacing:"-0.01em", color:"#1a1c1c" }}>{staff.name}</div>
            <div style={{ fontSize:".8rem", color:"#94a3b8", marginTop:2 }}>@{staff.username} · {staff.salary_type||"Monthly"}</div>
          </div>

          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:".7rem", color:"#94a3b8", fontWeight:600, letterSpacing:"0.04em", marginBottom:4 }}>OUTSTANDING BALANCE</div>
            <div style={{ fontSize:"1.6rem", fontWeight:800, letterSpacing:"-0.02em", color: runningBalance>0?"#ef4444":runningBalance<0?"#10b981":"#1a1c1c" }}>
              ₹{Math.abs(runningBalance).toLocaleString()}
            </div>
            {runningBalance!==0 && <div style={{ fontSize:".72rem", color:"#94a3b8" }}>{runningBalance>0?"You owe staff":"Staff owes advance"}</div>}
          </div>
        </div>

        {/* ── Segmented Pill Tabs ── */}
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:999, padding:4 }}>
          {[{id:"attendance",label:"Attendance"},{id:"payroll",label:"Payroll & Ledger"}].map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              flex:1, padding:"9px 0", borderRadius:999, border:"none", cursor:"pointer",
              background: activeTab===tab.id ? "#fff" : "transparent",
              color: activeTab===tab.id ? "#1a1c1c" : "#94a3b8",
              fontWeight: activeTab===tab.id ? 700 : 500,
              fontSize:".875rem", letterSpacing:"-0.01em",
              boxShadow: activeTab===tab.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition:"all .2s"
            }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ ATTENDANCE TAB ═══════ */}
      {activeTab==="attendance" && (
        <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>

          {/* Month nav + stats */}
          <div style={{ padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #f1f5f9" }}>
            {/* Arrow month nav */}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={prevMonth} style={{ width:32,height:32,borderRadius:"50%",border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#666" }}>
                <Icon name="chevron-left" size={16}/>
              </button>
              <span style={{ fontWeight:700, fontSize:".95rem", letterSpacing:"-0.01em", color:"#1a1c1c", minWidth:90, textAlign:"center" }}>
                {MONTH_FULL[month]} {year}
              </span>
              <button onClick={nextMonth} style={{ width:32,height:32,borderRadius:"50%",border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#666" }}>
                <Icon name="chevron-right" size={16}/>
              </button>
            </div>

            {/* Colored micro-badge stats */}
            <div style={{ display:"flex", gap:8 }}>
              {[
                { val:stats.p,  label:"PRESENT",  bg:"#dcfce7", color:"#166534" },
                { val:stats.a,  label:"ABSENT",   bg:"#fee2e2", color:"#991b1b" },
                { val:stats.hd, label:"HALF DAY", bg:"#fef3c7", color:"#92400e" },
                { val:stats.wo, label:"WEEK OFF",  bg:"#f1f5f9", color:"#475569" },
              ].map(s=>(
                <div key={s.label} style={{ background:s.bg, color:s.color, borderRadius:999, padding:"4px 10px", fontSize:".72rem", fontWeight:700, letterSpacing:"0.02em" }}>
                  ● {s.val} {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Day rows */}
          <div style={{ padding:"8px 0" }}>
            {Array.from({length:days},(_,i)=>i+1).map(day=>{
              const dt = new Date(year, month, day);
              const isSunday = dt.getDay()===0;
              const dayName = dt.toLocaleString("en-US",{weekday:"short"}).toUpperCase();
              const status = currentMonthAttendance[day] || (isSunday?"WO":"");

              return (
                <div key={day} style={{
                  display:"flex", alignItems:"center",
                  padding:"10px 24px",
                  background: isSunday ? "rgba(245,158,11,0.05)" : "transparent",
                  borderBottom:"1px solid #f8f9fa",
                  transition:"background .1s"
                }}>
                  {/* Day number */}
                  <div style={{ width:52, flexShrink:0 }}>
                    <div style={{ fontSize:"1.4rem", fontWeight:800, letterSpacing:"-0.02em", color: isSunday?"#d97706":"#1a1c1c", lineHeight:1 }}>
                      {String(day).padStart(2,"0")}
                    </div>
                    <div style={{ fontSize:".62rem", fontWeight:700, color:"#94a3b8", letterSpacing:"0.06em", marginTop:1 }}>
                      {dayName}
                    </div>
                  </div>

                  {/* Status context */}
                  <div style={{ flex:1, paddingLeft:12 }}>
                    {isSunday && !currentMonthAttendance[day] ? (
                      <span style={{ fontSize:".8rem", color:"#d97706", fontWeight:500 }}>Weekly Holiday</span>
                    ) : status ? (
                      <span style={{ fontSize:".8rem", color:"#94a3b8" }}>{ATT_COLORS[status]?.label}</span>
                    ) : (
                      <span style={{ fontSize:".8rem", color:"#cbd5e1", fontStyle:"italic" }}>Not marked yet</span>
                    )}
                  </div>

                  {/* Week Off badge for Sunday */}
                  {isSunday && !currentMonthAttendance[day] ? (
                    <div style={{ background:"#f1f5f9", color:"#64748b", fontSize:".72rem", fontWeight:700, padding:"5px 12px", borderRadius:999, letterSpacing:"0.04em" }}>
                      WEEK OFF
                    </div>
                  ) : (
                    /* Circle attendance buttons */
                    <div style={{ display:"flex", gap:6 }}>
                      {["P","A","HD","PL"].map(code=>(
                        <AttBtn key={code} code={code} active={status===code} onClick={()=>setStatus(day, status===code?"":code)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Confirm Monthly Attendance */}
          <div style={{ padding:"16px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"center" }}>
            <button onClick={()=>showToast("Monthly attendance confirmed!","success")} style={{
              background:"linear-gradient(135deg,#4f67ff,#6366f1)", color:"#fff",
              border:"none", borderRadius:999, padding:"13px 32px",
              fontSize:".95rem", fontWeight:700, cursor:"pointer",
              display:"flex", alignItems:"center", gap:8, letterSpacing:"-0.01em",
              boxShadow:"0 4px 16px #4f67ff44", transition:"transform .15s"
            }}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.02)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}
            >
              <Icon name="check" size={16}/> Confirm Monthly Attendance
            </button>
          </div>
        </div>
      )}

      {/* ═══════ PAYROLL & LEDGER TAB ═══════ */}
      {activeTab==="payroll" && (
        <div>
          {/* Summary cards */}
          <div style={{ display:"flex", gap:12, marginBottom:16 }}>
            {[
              { label:"SALARY/CYCLE", value:`₹${(staff.salary_amount||0).toLocaleString()}`, color:"#10b981" },
              { label:"TRANSACTIONS", value:`${transactions.length}`, color:"#4f67ff" },
              { label:"OUTSTANDING", value:`₹${Math.abs(runningBalance).toLocaleString()}`, color: runningBalance>0?"#ef4444":"#10b981" },
            ].map(s=>(
              <div key={s.label} style={{ flex:1, background:"#fff", borderRadius:14, padding:"16px 18px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize:".7rem", color:"#94a3b8", fontWeight:700, letterSpacing:"0.04em", marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:"1.2rem", fontWeight:800, color:s.color, letterSpacing:"-0.01em" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Record Transaction & Salary Slip Buttons */}
          <div style={{ display:"flex", gap:12, marginBottom:16 }}>
            <button onClick={()=>setPaymentModal(true)} style={{
              flex:1, background:"#4f67ff", color:"#fff",
              border:"none", borderRadius:999, padding:"12px 0",
              fontSize:".9rem", fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em",
              boxShadow:"0 2px 12px #4f67ff44"
            }}>
              ＋ Record Transaction
            </button>
            <button onClick={()=>setSlipModal(true)} style={{
              flex:1, background:"transparent", color:"#4f67ff",
              border:"2px solid #4f67ff", borderRadius:999, padding:"12px 0",
              fontSize:".9rem", fontWeight:700, cursor:"pointer", letterSpacing:"-0.01em"
            }}>
              📄 Generate Salary Slip
            </button>
          </div>

          {/* Ledger table */}
          <div style={{ background:"#fff", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ padding:"16px 24px", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:700, fontSize:".95rem", color:"#1a1c1c", letterSpacing:"-0.01em" }}>Salary Ledger</div>
              <div style={{ fontSize:".8rem", color:"#94a3b8" }}>{transactions.length} transactions</div>
            </div>

            {transactions.length===0 ? (
              <div style={{ textAlign:"center", padding:40, color:"#94a3b8" }}>
                <div style={{ fontSize:"1.5rem", marginBottom:8 }}>📋</div>
                <div style={{ fontWeight:600 }}>No transactions yet</div>
                <div style={{ fontSize:".85rem", marginTop:4 }}>Record the first transaction above</div>
              </div>
            ) : (
              transactions.map((t,i) => {
                const isCredit = t.type==="Salary";
                const typeBadge = {
                  Salary:   { bg:"#dcfce7", color:"#166534" },
                  Advance:  { bg:"#fee2e2", color:"#991b1b" },
                  Payment:  { bg:"#dbeafe", color:"#1e40af" },
                  Deduction:{ bg:"#fef3c7", color:"#92400e" },
                };
                const badge = typeBadge[t.type]||{bg:"#f1f5f9",color:"#475569"};
                return (
                  <div key={t.id} style={{
                    display:"flex", alignItems:"center", padding:"14px 24px",
                    background: i%2===0?"#fff":"#fafafa",
                    borderBottom:"1px solid #f8f9fa"
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:".85rem", fontWeight:600, color:"#1a1c1c" }}>{t.note||"Transaction"}</div>
                      <div style={{ fontSize:".75rem", color:"#94a3b8", marginTop:2 }}>
                        {new Date(t.created_at||t.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                      </div>
                    </div>
                    <div style={{ background:badge.bg, color:badge.color, fontSize:".72rem", fontWeight:700, padding:"4px 10px", borderRadius:999, marginRight:16 }}>
                      {t.type}
                    </div>
                    <div style={{ fontWeight:800, fontSize:"1rem", color:isCredit?"#10b981":"#ef4444", letterSpacing:"-0.01em", minWidth:80, textAlign:"right" }}>
                      {isCredit?"+":"−"}₹{Number(t.amount).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Record Transaction Modal ── */}
      {paymentModal && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 }}
          onClick={e=>e.target===e.currentTarget&&setPaymentModal(false)}>
          <div style={{ background:"#fff", borderRadius:16, padding:28, width:"min(420px,95vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#1a1c1c" }}>Record Transaction</div>
              <button onClick={()=>setPaymentModal(false)} style={{ width:32,height:32,borderRadius:"50%",border:"1.5px solid #e2e8f0",background:"transparent",cursor:"pointer",color:"#888" }}>×</button>
            </div>
            <div style={{ height:1, background:"#f1f5f9", marginBottom:20 }}/>

            {/* Type pill toggle */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:".7rem", color:"#94a3b8", fontWeight:700, letterSpacing:"0.04em", marginBottom:8 }}>TYPE</div>
              <div style={{ display:"flex", background:"#f1f5f9", borderRadius:999, padding:3, gap:2 }}>
                {["Salary","Payment","Advance","Deduction"].map(t=>(
                  <button key={t} onClick={()=>setPaymentForm({...paymentForm,type:t})} style={{
                    flex:1, padding:"7px 0", borderRadius:999, border:"none", cursor:"pointer",
                    background:paymentForm.type===t?"#4f67ff":"transparent",
                    color:paymentForm.type===t?"#fff":"#666",
                    fontWeight:600, fontSize:".75rem", transition:"all .15s"
                  }}>{t}</button>
                ))}
              </div>
            </div>

            {[
              { label:"AMOUNT (₹)", field:"amount", type:"number", placeholder:"0" },
              { label:"NOTE (OPTIONAL)", field:"note", type:"text", placeholder:"e.g. Salary for April 2026" },
            ].map(f=>(
              <div key={f.field} style={{ marginBottom:16 }}>
                <div style={{ fontSize:".7rem", color:"#94a3b8", fontWeight:700, letterSpacing:"0.04em", marginBottom:6 }}>{f.label}</div>
                <input type={f.type} value={paymentForm[f.field]} onChange={e=>setPaymentForm({...paymentForm,[f.field]:e.target.value})} placeholder={f.placeholder}
                  style={{ width:"100%", background:"transparent", border:"none", borderBottom:"1.5px solid #e2e8f0", padding:"8px 0", fontSize:"1rem", color:"#1a1c1c", outline:"none", boxSizing:"border-box" }}
                  onFocus={e=>e.target.style.borderBottomColor="#4f67ff"}
                  onBlur={e=>e.target.style.borderBottomColor="#e2e8f0"}
                />
              </div>
            ))}

            <div style={{ height:1, background:"#f1f5f9", margin:"20px 0" }}/>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <button onClick={()=>setPaymentModal(false)} style={{ background:"transparent", border:"none", cursor:"pointer", color:"#888", fontWeight:600 }}>Cancel</button>
              <button onClick={handleApplyTransaction} style={{ background:"#4f67ff", color:"#fff", border:"none", borderRadius:999, padding:"10px 24px", fontWeight:700, cursor:"pointer", boxShadow:"0 2px 12px #4f67ff44" }}>
                Apply to Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Salary Slip Modal ── */}
      {slipModal && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000, overflowY:"auto", padding:20 }}
          onClick={e=>e.target===e.currentTarget&&setSlipModal(false)}>
          <div style={{ background:"#fff", borderRadius:16, width:"min(800px, 95vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.2)", display:"flex", flexDirection:"column", maxHeight:"90vh" }}>
            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 24px", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:"1.1rem", fontWeight:700, color:"#1a1c1c" }}>Salary Slip Generator</div>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={()=>{
                  const prtHtml = document.getElementById("hidden-salary-slip").innerHTML;
                  const winPrint = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
                  winPrint.document.write('<html><head><title>Salary Slip</title><style>@media print { @page { size: auto; margin: 0mm; } body { margin: 1cm; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style></head><body>');
                  winPrint.document.write(prtHtml);
                  winPrint.document.write('</body></html>');
                  winPrint.document.close();
                  winPrint.focus();
                  setTimeout(()=> { winPrint.print(); winPrint.close(); }, 500);
                }} style={{ background:"#4f67ff", color:"#fff", border:"none", borderRadius:999, padding:"8px 16px", fontWeight:700, cursor:"pointer" }}>🖨️ Print Slip</button>
                <button onClick={()=>setSlipModal(false)} style={{ width:32,height:32,borderRadius:"50%",border:"1.5px solid #e2e8f0",background:"transparent",cursor:"pointer",color:"#888" }}>×</button>
              </div>
            </div>

            {/* Slip Preview */}
            <div style={{ padding:"24px", overflowY:"auto", background:"#f8f9fa", flex:1, display:"flex", justifyContent:"center" }}>
              <div id="hidden-salary-slip" style={{ width:"210mm", minHeight:"140mm", background:"#fff", padding:"40px", boxSizing:"border-box", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", position:"relative", fontFamily:"sans-serif", color:"#000" }}>
                 <div style={{ textAlign:"center", paddingBottom:"20px", borderBottom:"2px solid #000" }}>
                    <h1 style={{ margin:0, fontSize:"26px", textTransform:"uppercase", letterSpacing:"2px" }}>SALARY SLIP</h1>
                    <div style={{ fontSize:"14px", color:"#444", marginTop:"5px" }}>For the month of {MONTH_FULL[month]} {year}</div>
                 </div>

                 <div style={{ display:"flex", justifyContent:"space-between", marginTop:"30px" }}>
                    <div>
                       <div style={{ fontSize:"12px", color:"#666", marginBottom:"4px", fontWeight:"bold" }}>EMPLOYEE DETAILS</div>
                       <div style={{ fontSize:"22px", fontWeight:"bold" }}>{staff.name}</div>
                       <div style={{ fontSize:"14px", marginTop:"4px" }}>Designation: {staff.salary_type || "Staff"} Worker</div>
                       <div style={{ fontSize:"14px" }}>Employee ID: {staff.username || staff.id.substring(0,8)}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                       <div style={{ fontSize:"12px", color:"#666", marginBottom:"4px", fontWeight:"bold" }}>ATTENDANCE SUMMARY</div>
                       <div style={{ fontSize:"14px" }}>Total Month Days: {days}</div>
                       <div style={{ fontSize:"14px" }}>Present: <b>{stats.p}</b> | Absent: <b>{stats.a}</b></div>
                       <div style={{ fontSize:"14px" }}>Paid Leave/WO: <b>{stats.pl + stats.wo}</b></div>
                    </div>
                 </div>

                 <div style={{ display:"flex", gap:"30px", marginTop:"40px" }}>
                    {/* Earnings */}
                    <div style={{ flex:1, border:"1px solid #ccc", borderRadius:"8px", overflow:"hidden" }}>
                       <div style={{ background:"#f4f4f4", padding:"12px 16px", borderBottom:"1px solid #ccc", fontWeight:"bold" }}>EARNINGS</div>
                       <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #eee", fontSize:"14px" }}>
                          <span>Basic Salary</span>
                          <span>₹{(staff.salary_amount||0).toLocaleString()}</span>
                       </div>
                       <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", background:"#fafafa", fontWeight:"bold", borderTop:"1px solid #ccc" }}>
                          <span>Gross Earnings</span>
                          <span>₹{(staff.salary_amount||0).toLocaleString()}</span>
                       </div>
                    </div>

                    {/* Deductions */}
                    <div style={{ flex:1, border:"1px solid #ccc", borderRadius:"8px", overflow:"hidden" }}>
                       <div style={{ background:"#f4f4f4", padding:"12px 16px", borderBottom:"1px solid #ccc", fontWeight:"bold" }}>DEDUCTIONS</div>
                       <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #eee", fontSize:"14px" }}>
                          <span>Absents ({stats.a} days)</span>
                          <span>₹{(staff.salary_type === "Monthly" ? Math.round(((staff.salary_amount||0)/days)*stats.a) : 0).toLocaleString()}</span>
                       </div>
                       <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #eee", fontSize:"14px" }}>
                          <span>Advances & Ledger Deductions</span>
                          <span>₹{Math.abs(transactions.filter(t=>(new Date(t.date||t.created_at).getMonth()===month) && (t.type==="Advance"||t.type==="Deduction")).reduce((s,t)=>s+Number(t.amount),0)).toLocaleString()}</span>
                       </div>
                       <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", background:"#fafafa", fontWeight:"bold", borderTop:"1px solid #ccc" }}>
                          <span>Total Deductions</span>
                          <span>₹{((staff.salary_type === "Monthly" ? Math.round(((staff.salary_amount||0)/days)*stats.a) : 0) + transactions.filter(t=>(new Date(t.date||t.created_at).getMonth()===month) && (t.type==="Advance"||t.type==="Deduction")).reduce((s,t)=>s+Number(t.amount),0)).toLocaleString()}</span>
                       </div>
                    </div>
                 </div>

                 {/* Net Pay */}
                 <div style={{ marginTop:"30px", border:"1px solid #ccc", borderRadius:"8px", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px", background:"#fcfcfc" }}>
                    <div style={{ fontSize:"18px", fontWeight:"bold" }}>NET PAYABLE</div>
                    <div style={{ fontSize:"26px", fontWeight:"bold" }}>
                        ₹{Math.max(0, (
                           (staff.salary_amount||0) - 
                           (staff.salary_type === "Monthly" ? Math.round(((staff.salary_amount||0)/days)*stats.a) : 0) -
                           transactions.filter(t=>(new Date(t.date||t.created_at).getMonth()===month) && (t.type==="Advance"||t.type==="Deduction")).reduce((s,t)=>s+Number(t.amount),0)
                        )).toLocaleString()}
                    </div>
                 </div>

                 {/* Footer */}
                 <div style={{ marginTop:"80px", display:"flex", justifyContent:"space-between" }}>
                    <div style={{ borderTop:"1px solid #000", paddingTop:"10px", width:"200px", textAlign:"center", fontSize:"14px" }}>Employer Signature</div>
                    <div style={{ borderTop:"1px solid #000", paddingTop:"10px", width:"200px", textAlign:"center", fontSize:"14px" }}>Employee Signature</div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
