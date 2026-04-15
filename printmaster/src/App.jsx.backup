import { useState, useEffect, useRef } from "react";
import { db, subscribeToTaskAssignments } from "./supabase.js";

// ── In-memory store ───────────────────────────────────────────────────────────
const ADMIN = { username: "admin", password: "admin123", role: "admin", name: "Admin" };
const WORKERS_INIT = [
  { id: "w1", username: "ravi", password: "ravi123", name: "Ravi Kumar", role: "worker" },
  { id: "w2", username: "sunita", password: "sunita123", name: "Sunita Devi", role: "worker" },
];

// ── Default brand/settings (hard-coded for live use) ─────────────────────────
// These values are used both as in-memory defaults and as the base when
// loading from Supabase. If the DB is empty or unreachable, the app will
// always fall back to these details.
const DEFAULT_BRAND = {
  shopName: "SHIROMANI PRINTERS",
  address: "Vivekanand Market, Adarsh Colony, Chittorgarh, Rajasthan, 312601",
  phone: "9413047965",
  whatsapp: "919413047965",
  gmail: "shiromanioffsetnbh@gmail.com",
  logo: null,
  paymentQr: "/payment-qr.png",
  paymentQrLocked: true,
  upiId: "BHARATPE.8Z0L0E4H5U44105@fbpe",
  invoicePrefix: "NPW",
  invoiceCounter: 4,
};

const now = () => new Date().toISOString();
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtCur = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const genInvId = (brand) => `${brand.invoicePrefix || "NPW"}-${String(brand.invoiceCounter || 1).padStart(4, "0")}`;
const qrImgUrl = (data, size = 100) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
// UPI intent for fixed-amount QR (non-editable, opens payment app with amount)
const upiIntentUrl = (amount, upiId, payeeName) => {
  const am = Number(amount).toFixed(2);
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName || "Merchant")}&am=${am}&cu=INR`;
};
const readFile64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f0f2f8;--surface:#fff;--surface2:#f7f8fc;--border:#e4e8f0;--accent:#4f67ff;--accent2:#7c3aed;--accent-soft:#eef0ff;--success:#10b981;--warning:#f59e0b;--danger:#ef4444;--text:#1a1d2e;--text2:#6b7280;--text3:#9ca3af;--shadow:0 1px 3px rgba(0,0,0,.06),0 4px 16px rgba(0,0,0,.06);--shadow-lg:0 8px 32px rgba(0,0,0,.10);--radius:14px;--radius-sm:8px;--sw:240px;--font:'Sora',sans-serif;--mono:'JetBrains Mono',monospace;--t:.2s cubic-bezier(.4,0,.2,1)}
.dark{--bg:#0e101a;--surface:#161827;--surface2:#1e2035;--border:#2a2d45;--text:#f0f2ff;--text2:#9ca3af;--text3:#6b7280;--accent-soft:#1e204a;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.3);--shadow-lg:0 8px 32px rgba(0,0,0,.4)}
body{font-family:var(--font);background:var(--bg);color:var(--text);transition:background var(--t),color var(--t);min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}
.app-layout{display:flex;min-height:100vh}
.main-content{flex:1;margin-left:var(--sw);min-height:100vh;transition:margin var(--t)}
@media(max-width:768px){.main-content{margin-left:0}}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sw);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:100;transition:transform var(--t),background var(--t);overflow-y:auto}
.sidebar.open{transform:translateX(0)}
.s-logo{padding:16px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.s-logo img{width:36px;height:36px;border-radius:8px;object-fit:contain;background:var(--accent-soft)}
.s-logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.s-brand{font-weight:800;font-size:1rem;color:var(--accent);letter-spacing:-.02em}
.s-sub{font-size:.65rem;color:var(--text3);font-weight:500;margin-top:1px}
.s-nav{padding:12px 10px;flex:1}
.s-sec{font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.1em;padding:10px 10px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-sm);cursor:pointer;font-size:.85rem;font-weight:500;color:var(--text2);margin:1px 0;transition:all var(--t)}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:var(--accent-soft);color:var(--accent);font-weight:600}
.nav-item .nbadge{margin-left:auto;background:var(--danger);color:#fff;font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:99px;font-family:var(--mono)}
.s-footer{padding:14px 12px;border-top:1px solid var(--border)}
.user-chip{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--radius-sm);background:var(--surface2);cursor:pointer;transition:all var(--t)}
.user-chip:hover{background:var(--border)}
.u-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff;flex-shrink:0}
.u-name{font-size:.82rem;font-weight:600;color:var(--text)}
.u-role{font-size:.68rem;color:var(--text3)}
.topbar{position:sticky;top:0;z-index:50;background:var(--surface);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;align-items:center;gap:12px;transition:background var(--t)}
.topbar-title{font-size:1rem;font-weight:700;flex:1}
.topbar-logo{height:32px;width:auto;max-width:100px;object-fit:contain}
.page{padding:24px;max-width:1200px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow);transition:box-shadow var(--t),background var(--t)}
.card:hover{box-shadow:var(--shadow-lg)}
.card-title{font-size:.9rem;font-weight:700;margin-bottom:16px;color:var(--text)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:20px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow);transition:all var(--t);position:relative;overflow:hidden}
.stat-card:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--c1),var(--c2))}
.stat-value{font-size:1.5rem;font-weight:800;font-family:var(--mono);color:var(--text);line-height:1}
.stat-label{font-size:.72rem;color:var(--text2);margin-top:4px;font-weight:500}
.stat-sub{font-size:.68rem;color:var(--text3);margin-top:2px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--radius-sm);font-family:var(--font);font-size:.82rem;font-weight:600;border:none;cursor:pointer;transition:all var(--t);white-space:nowrap}
.btn-primary{background:var(--accent);color:#fff}
.btn-primary:hover{background:#3d55f0;transform:translateY(-1px);box-shadow:0 4px 14px rgba(79,103,255,.35)}
.btn-success{background:var(--success);color:#fff}
.btn-success:hover{background:#059669}
.btn-danger{background:var(--danger);color:#fff}
.btn-danger:hover{background:#dc2626}
.btn-warning{background:var(--warning);color:#fff}
.btn-ghost{background:var(--surface2);color:var(--text2);border:1px solid var(--border)}
.btn-ghost:hover{background:var(--border);color:var(--text)}
.btn-sm{padding:5px 11px;font-size:.75rem}
.btn-icon{padding:8px}
.btn-wa{background:#25D366;color:#fff}
.btn-wa:hover{background:#128C7E}
.btn-gmail{background:#EA4335;color:#fff}
.btn-gmail:hover{background:#c5221f}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:600px){.form-grid{grid-template-columns:1fr}}
.form-group{display:flex;flex-direction:column;gap:5px}
.form-group.full{grid-column:1/-1}
label{font-size:.75rem;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.04em}
input,select,textarea{font-family:var(--font);font-size:.85rem;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:9px 12px;color:var(--text);outline:none;transition:border-color var(--t),box-shadow var(--t);width:100%}
input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(79,103,255,.12)}
input[readonly]{opacity:.7;cursor:not-allowed}
textarea{resize:vertical;min-height:80px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{background:var(--surface2);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);padding:10px 14px;text-align:left}
td{padding:11px 14px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--surface2)}
.badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:.68rem;font-weight:700;letter-spacing:.02em}
.badge-green{background:#d1fae5;color:#065f46}
.badge-yellow{background:#fef3c7;color:#92400e}
.badge-red{background:#fee2e2;color:#991b1b}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-purple{background:#ede9fe;color:#5b21b6}
.dark .badge-green{background:#064e3b;color:#6ee7b7}
.dark .badge-yellow{background:#451a03;color:#fcd34d}
.dark .badge-red{background:#450a0a;color:#fca5a5}
.dark .badge-blue{background:#1e3a5f;color:#93c5fd}
.dark .badge-purple{background:#2e1065;color:#c4b5fd}
.toggle-wrap{display:flex;align-items:center;gap:8px;cursor:pointer}
.toggle{width:40px;height:22px;background:var(--border);border-radius:99px;position:relative;transition:background var(--t);cursor:pointer;border:none;padding:0;flex-shrink:0}
.toggle.on{background:var(--accent)}
.toggle::after{content:'';position:absolute;left:3px;top:3px;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform var(--t);box-shadow:0 1px 3px rgba(0,0,0,.2)}
.toggle.on::after{transform:translateX(18px)}
.toggle-label{font-size:.82rem;font-weight:500;color:var(--text2)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .15s ease}
.modal{background:var(--surface);border-radius:var(--radius);padding:24px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .2s ease}
.modal-title{font-size:1.05rem;font-weight:800;margin-bottom:20px}
.modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.search-bar{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:7px 12px;transition:border-color var(--t)}
.search-bar:focus-within{border-color:var(--accent)}
.search-bar input{background:transparent;border:none;padding:0;font-size:.85rem;flex:1}
.search-bar input:focus{box-shadow:none}
.alert{position:fixed;top:20px;right:20px;z-index:300;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 18px;box-shadow:var(--shadow-lg);font-size:.85rem;font-weight:500;display:flex;align-items:center;gap:10px;animation:slideLeft .25s ease;max-width:320px}
@keyframes slideLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea22,#764ba222),var(--bg);padding:20px}
.login-card{width:100%;max-width:380px}
.quick-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:100px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.bar{width:100%;background:linear-gradient(to top,var(--accent),var(--accent2));border-radius:4px 4px 0 0;transition:height .4s ease;min-height:4px}
.bar-label{font-size:.62rem;color:var(--text3);font-family:var(--mono)}
.mob-btn{display:none}
@media(max-width:768px){.mob-btn{display:flex}.sidebar{transform:translateX(-100%)}.s-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}}
.flex{display:flex}.flex-1{flex:1}.items-center{align-items:center}.justify-between{justify-content:space-between}.gap-2{gap:8px}.gap-3{gap:12px}.mb-4{margin-bottom:16px}.mb-3{margin-bottom:12px}.text-sm{font-size:.82rem}.font-mono{font-family:var(--mono)}.divider{height:1px;background:var(--border);margin:16px 0}
/* Settings */
.set-sec-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--accent-soft)}
.upload-box{border:2px dashed var(--border);border-radius:var(--radius-sm);padding:20px;text-align:center;cursor:pointer;transition:all var(--t);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.upload-box:hover{border-color:var(--accent);background:var(--accent-soft)}
.lock-badge{display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-size:.68rem;font-weight:700;margin-top:6px}
.dark .lock-badge{background:#451a03;color:#fcd34d}
/* Invoice */
.inv-wrap{background:#fff;color:#1a1d2e;font-family:'Sora',sans-serif;padding:30px;border-radius:10px}
.inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #4f67ff}
.inv-logo{width:60px;height:60px;object-fit:contain;border-radius:8px}
.inv-logo-ph{width:60px;height:60px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center}
.inv-shop-name{font-size:1.2rem;font-weight:800;color:#4f67ff;letter-spacing:-.02em}
.inv-shop-details{font-size:.7rem;color:#6b7280;margin-top:3px;line-height:1.7}
.inv-right{text-align:right}
.inv-title{font-size:2rem;font-weight:900;color:#1a1d2e;letter-spacing:-.04em;text-transform:uppercase}
.inv-meta{font-size:.7rem;color:#6b7280;margin-top:5px;line-height:1.8}
.inv-bill-row{display:flex;gap:12px;margin-bottom:18px}
.inv-bill-box{background:#f7f8fc;border-radius:8px;padding:11px 14px;flex:1}
.inv-lbl{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#4b5563;margin-bottom:3px}
.inv-val{font-size:.8rem;font-weight:600;color:#1a1d2e}
.inv-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:.78rem}
.inv-table thead tr{background:#2d3a9f!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-table th{color:#fff!important;background:#2d3a9f!important;padding:8px 11px;text-align:left;font-size:.66rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-table td{padding:9px 11px;border-bottom:1px solid #e4e8f0;color:#1a1d2e}
.inv-table tbody tr:nth-child(even) td{background:#f7f8fc}
.inv-totals{display:flex;justify-content:flex-end;margin-bottom:18px}
.inv-totals-box{min-width:210px}
.inv-total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:.8rem;color:#374151}
.inv-grand{display:flex;justify-content:space-between;padding:9px 13px;margin-top:7px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;font-size:.95rem;font-weight:800;color:#fff}
.inv-status{display:inline-flex;align-items:center;gap:5px;padding:5px 13px;border-radius:99px;font-size:.75rem;font-weight:800}
.inv-paid{background:#d1fae5;color:#065f46}
.inv-unpaid{background:#fee2e2;color:#991b1b}
.inv-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid #e4e8f0}
.inv-qr-group{display:flex;gap:14px}
.inv-qr-label{font-size:.6rem;color:#6b7280;text-align:center;margin-top:3px}
@media print{.no-print{display:none!important}body{background:#fff!important;color:#000!important}.modal-overlay{position:static;background:none;padding:0}.modal{box-shadow:none;max-height:none;padding:0}}
`;

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 16, color = "currentColor" }) => {
  const p = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
    billing: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    tasks: <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    workers: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    vendor: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M3 9h18"/><path d="M12 3v18"/></>,
    payment: <><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></>,
    customers: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    admin: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
    moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    trash: <><polyline points="3,6 5,6 21,6"/><path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    whatsapp: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>,
    mail: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
    search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    check: <><polyline points="20,6 9,17 4,12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    export: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    printer: <><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    upload: <><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[name]||null}</svg>;
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const col = { success: "#10b981", error: "#ef4444", info: "#4f67ff", warning: "#f59e0b" };
  return <div className="alert" style={{ borderLeft: `4px solid ${col[type]}` }}><span>{type==="success"?"✓":"✕"}</span>{msg}</div>;
};

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);

  // Brand / settings — start from in-memory defaults, then hydrate from Supabase in loadAll
  const [brand, setBrandState] = useState(DEFAULT_BRAND);
  const setBrand = (val) => {
    const next = typeof val === "function" ? val(brand) : val;
    setBrandState(next);
    db.saveBrand(next);
  };

  const [bills, setBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [customers, setCustomers] = useState([]);
  // Admin password lives only in React state (no localStorage)
  const [adminPassword, setAdminPassword] = useState(ADMIN.password);
  const changeAdminPassword = (newPass) => {
    setAdminPassword(newPass);
  };

  // Restore logged-in user from localStorage (so refresh doesn't log out)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pm_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.username && parsed.role) {
          setUser(parsed);
        }
      }
    } catch (e) {
      console.error("restoreUser:", e);
    }
  }, []);

  // Load all data from Supabase on mount
  useEffect(() => {
    async function loadAll() {
      setDbLoading(true);
      const [b, p, t, c, w, v, vb, dbBrand] = await Promise.all([
        db.getBills(),
        db.getPurchases(),
        db.getTasks(),
        db.getCustomers(),
        db.getWorkers(),
        db.getVendors(),
        db.getVendorBills(),
        db.loadBrand(DEFAULT_BRAND),
      ]);
      setBills(b);
      setPurchases(p);
      setTasks(t);
      setCustomers(c);
      setVendors(v || []);
      setVendorBills(vb || []);
      // Workers now come only from Supabase (no local defaults).
      // Filter out any accidental Admin row from workers table, only keep real workers.
      const realWorkers = (w || []).filter(x => x.role === "worker" || x.username !== "admin");
      setWorkers(realWorkers);
      // Brand (including logo and payment QR) now comes fully from Supabase
      const baseBrand = dbBrand || DEFAULT_BRAND;
      if (b.length > 0) {
        const nums = b.map(x => parseInt((x.id || "").split("-")[1] || "0")).filter(n => !isNaN(n));
        const maxNum = Math.max(...nums, 0);
        const merged = { ...baseBrand, invoiceCounter: Math.max(baseBrand.invoiceCounter || 0, maxNum + 1) };
        setBrandState(merged);
        db.saveBrand(merged);
      } else if (dbBrand) {
        setBrandState(dbBrand);
      } else {
        setBrandState(baseBrand);
      }
      setDbLoading(false);
    }
    loadAll();
  }, []);

  const showToast = (msg, type = "success") => setToast({ msg, type });
  const addNotification = (msg) => setNotifications(n => [{ id: Date.now(), msg, read: false, time: now() }, ...n]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const paidBills = bills.filter(b => b.paid);
  const unpaidBills = bills.filter(b => !b.paid);
  const totalRevenue = paidBills.reduce((s, b) => s + b.total, 0);
  const totalPending = unpaidBills.reduce((s, b) => s + b.total, 0);

  useEffect(() => {
    document.documentElement.classList[dark ? "add" : "remove"]("dark");
  }, [dark]);

  // Realtime + browser notifications for workers/vendors when task is assigned
  useEffect(() => {
    if (!user || (user.role !== "worker" && user.role !== "vendor")) return;
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "default") {
        showToast("Allow notifications to get task alerts on this device", "info");
        Notification.requestPermission();
      }
    }
    const unsub = subscribeToTaskAssignments(user.id, user.role, (task) => {
      const msg = `New task assigned to you: "${task.title}"${task.customer ? ` (${task.customer})` : ""}`;
      addNotification(msg);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification("PrintMaster – New Task", { body: msg, tag: "task-" + task.id });
        } catch (e) {}
      }
    });
    return unsub;
  }, [user?.id, user?.role]);

  if (dbLoading) return (
    <><style>{CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:"var(--bg)"}}>
        <div style={{width:52,height:52,background:"linear-gradient(135deg,#4f67ff,#7c3aed)",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon name="printer" size={26} color="#fff"/>
        </div>
        <div style={{fontWeight:800,fontSize:"1.1rem",color:"var(--accent)"}}>Loading PrintMaster Pro…</div>
        <div style={{width:200,height:5,background:"var(--border)",borderRadius:99,overflow:"hidden"}}>
          <div style={{height:"100%",background:"linear-gradient(90deg,#4f67ff,#7c3aed)",borderRadius:99,animation:"lb 1.4s ease-in-out infinite"}}/>
        </div>
        <div style={{fontSize:".75rem",color:"var(--text3)"}}>Connecting to database…</div>
        <style>{`@keyframes lb{0%{width:0%}100%{width:100%}}`}</style>
      </div>
    </>
  );

  if (!user) {
    const invId = new URLSearchParams(window.location.search).get("inv");
    const payId = new URLSearchParams(window.location.search).get("pay");
    if (payId) {
      return (
        <>
          <style>{CSS}</style>
          <PayQRPage invId={payId} />
        </>
      );
    }
    if (invId) {
      return (
        <>
          <style>{CSS}</style>
          <PublicInvoicePage invId={invId} />
        </>
      );
    }
    return (
      <>
        <style>{CSS}</style>
        <LoginPage
          brand={brand}
          workers={workers}
          vendors={vendors}
          adminPassword={adminPassword}
          onLogin={u => {
            const simpleUser = { id: u.id, name: u.name, role: u.role, username: u.username };
            setUser(simpleUser);
            try {
              localStorage.setItem("pm_user", JSON.stringify(simpleUser));
            } catch (e) {
              console.error("saveUser:", e);
            }
            showToast("Welcome, " + u.name + "!");
          }}
        />
        {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      </>
    );
  }

  const navItems = user.role === "admin" ? [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "billing", label: "Billing", icon: "billing" },
    { id: "tasks", label: "Task Management", icon: "tasks", badge: pendingTasks.length },
    { id: "workers", label: "Workers", icon: "workers" },
    { id: "vendors", label: "Vendors", icon: "vendor" },
    { id: "payments", label: "Payments", icon: "payment" },
    { id: "purchases", label: "Purchases", icon: "billing" },
    { id: "customers", label: "Customers", icon: "customers" },
    { id: "reports", label: "Revenue Reports", icon: "chart" },
    { id: "admin", label: "Admin Panel", icon: "admin" },
    { id: "settings", label: "Settings", icon: "settings" },
  ] : user.role === "vendor" ? [
    { id: "vendor-dashboard", label: "My Dashboard", icon: "dashboard" },
    { id: "vendor-tasks", label: "My Tasks", icon: "tasks" },
    { id: "vendor-bills", label: "Create Bill", icon: "billing" },
  ] : [
    { id: "worker-dashboard", label: "My Dashboard", icon: "dashboard" },
    { id: "billing", label: "Billing", icon: "billing" },
    { id: "worker-tasks", label: "My Tasks", icon: "tasks" },
  ];

  const pages = {
    dashboard: <DashboardPage bills={bills} tasks={tasks} workers={workers} vendors={vendors} totalRevenue={totalRevenue} totalPending={totalPending} paidBills={paidBills} unpaidBills={unpaidBills} pendingTasks={pendingTasks} completedTasks={completedTasks} setPage={setPage} brand={brand} />,
    billing: <BillingPage bills={bills} setBills={setBills} showToast={showToast} customers={customers} setCustomers={setCustomers} brand={brand} setBrand={setBrand} />,
    tasks: <TasksPage tasks={tasks} setTasks={setTasks} workers={workers} vendors={vendors} showToast={showToast} addNotification={addNotification} />,
    workers: <WorkersPage workers={workers} setWorkers={setWorkers} showToast={showToast} />,
    vendors: <VendorsPage vendors={vendors} setVendors={setVendors} vendorBills={vendorBills} setVendorBills={setVendorBills} showToast={showToast} brand={brand} />,
    payments: <PaymentsPage bills={bills} setBills={setBills} showToast={showToast} />,
    purchases: <PurchasesPage purchases={purchases} setPurchases={setPurchases} showToast={showToast} />,
    customers: <CustomersPage customers={customers} bills={bills} />,
    reports: <ReportsPage bills={bills} />,
    admin: <AdminPanel bills={bills} tasks={tasks} workers={workers} vendors={vendors} vendorBills={vendorBills} />,
    settings: <SettingsPage brand={brand} setBrand={setBrand} showToast={showToast} adminPassword={adminPassword} changeAdminPassword={changeAdminPassword} workers={workers} setWorkers={setWorkers} user={user} />,
    "worker-dashboard": <WorkerDashboard tasks={tasks} user={user} />,
    "worker-tasks": <WorkerTasks tasks={tasks} setTasks={setTasks} user={user} showToast={showToast} addNotification={addNotification} />,
    "vendor-dashboard": <VendorDashboard tasks={tasks} user={user} vendorBills={vendorBills} />,
    "vendor-tasks": <VendorTasks tasks={tasks} setTasks={setTasks} user={user} showToast={showToast} addNotification={addNotification} />,
    "vendor-bills": <VendorBillsPage vendorBills={vendorBills} setVendorBills={setVendorBills} user={user} showToast={showToast} brand={brand} />,
  };

  const titles = { dashboard:"Dashboard", billing:"Billing", tasks:"Task Management", workers:"Workers", vendors:"Vendors", payments:"Payments", purchases:"Purchases", customers:"Customers", reports:"Revenue Reports", admin:"Admin Panel", settings:"Settings", "worker-dashboard":"My Dashboard", "worker-tasks":"My Tasks", "vendor-dashboard":"Vendor Dashboard", "vendor-tasks":"My Tasks", "vendor-bills":"Create Bill" };

  return (
    <><style>{CSS}</style>
      <div className="app-layout">
        {sidebarOpen && <div className="s-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="s-logo">
            {brand.logo
              ? <img src={brand.logo} alt="logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "contain" }} />
              : <div className="s-logo-icon"><Icon name="printer" size={16} color="#fff" /></div>}
            <div><div className="s-brand">{brand.shopName}</div><div className="s-sub">Management System</div></div>
          </div>
          <nav className="s-nav">
            <div className="s-sec">Navigation</div>
            {navItems.map(item => (
              <div key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => { setPage(item.id); setSidebarOpen(false); }}>
                <Icon name={item.icon} size={16} />
                {item.label}
                {item.badge > 0 && <span className="nbadge">{item.badge}</span>}
              </div>
            ))}
          </nav>
          <div className="s-footer">
            <div className="user-chip" onClick={() => { setUser(null); localStorage.removeItem("pm_user"); setPage("dashboard"); }}>
              <div className="u-av">{user.name[0]}</div>
              <div className="flex-1"><div className="u-name">{user.name}</div><div className="u-role">{user.role === "admin" ? "Administrator" : user.role === "vendor" ? "Vendor" : "Worker"}</div></div>
              <Icon name="logout" size={14} color="var(--text3)" />
            </div>
          </div>
        </aside>

        <div className="main-content">
          <header className="topbar">
            <button className="btn btn-icon btn-ghost mob-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><Icon name="menu" size={18} /></button>
            {brand.logo && <img src={brand.logo} alt="logo" className="topbar-logo" />}
            <div className="topbar-title">{titles[page] || page}</div>
            <div className="flex gap-2 items-center" style={{ position: "relative" }}>
              <button className="btn btn-icon btn-ghost" onClick={() => setDark(!dark)}><Icon name={dark ? "sun" : "moon"} size={16} /></button>
              <button className="btn btn-icon btn-ghost" style={{ position: "relative" }} onClick={() => { setNotifPanelOpen(o => !o); if (unreadCount > 0) setNotifications(n => n.map(x => ({ ...x, read: true }))); }}>
                <Icon name="bell" size={16} />
                {unreadCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, background: "var(--danger)", borderRadius: "50%", border: "2px solid var(--surface)" }} />}
              </button>
              {notifPanelOpen && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setNotifPanelOpen(false)} />
                  <div className="card" style={{ position: "absolute", top: "100%", right: 0, marginTop: 8, minWidth: 280, maxWidth: 360, maxHeight: 320, overflowY: "auto", zIndex: 200, padding: 12 }}>
                    <div style={{ fontWeight: 700, fontSize: ".85rem", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      Notifications
                      {notifications.length > 0 && <button className="btn btn-sm btn-ghost" onClick={() => setNotifications([])}>Clear all</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ fontSize: ".8rem", color: "var(--text3)", padding: 16, textAlign: "center" }}>No notifications yet</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {notifications.slice(0, 20).map(n => (
                          <div key={n.id} style={{ padding: 10, background: n.read ? "transparent" : "var(--accent-soft)", borderRadius: 8, fontSize: ".8rem", borderLeft: n.read ? "none" : "3px solid var(--accent)" }}>
                            <div style={{ color: "var(--text)" }}>{n.msg}</div>
                            <div style={{ fontSize: ".68rem", color: "var(--text3)", marginTop: 4 }}>{n.time ? fmtDate(n.time) : ""}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </header>
          <div className="page">{pages[page] || null}</div>
        </div>
      </div>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ brand, workers, vendors, adminPassword, onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  const go = () => {
    setLoading(true);
    setTimeout(() => {
      const adminUser = { ...ADMIN, password: adminPassword };
      const vendorUsers = (vendors || []).map(v => ({ ...v, role: "vendor", name: v.name || v.firm_name || v.username }));
      const all = [adminUser, ...workers, ...vendorUsers];
      const u = all.find(u => u.username === form.username && u.password === form.password);
      u ? (setErr(""), onLogin(u)) : setErr("Invalid credentials. Please check your username and password.");
      setLoading(false);
    }, 600);
  };
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          {brand.logo ? <img src={brand.logo} alt="logo" style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 16, margin: "0 auto 12px", display: "block" }} />
            : <div style={{ width: 56, height: 56, background: "linear-gradient(135deg,#4f67ff,#7c3aed)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon name="printer" size={26} color="#fff" /></div>}
          <div style={{ fontWeight: 800, fontSize: "1.4rem", color: "var(--accent)" }}>{brand.shopName}</div>
          <div style={{ fontSize: ".8rem", color: "var(--text3)", marginTop: 2 }}>Printing Press Management System</div>
        </div>
        <div className="card">
          <div className="form-group mb-4"><label htmlFor="login-username">Username</label><input id="login-username" name="username" autoComplete="username" placeholder="admin" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} onKeyDown={e => e.key==="Enter"&&go()} style={{ fontSize: 16 }} /></div>
          <div className="form-group mb-4"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} onKeyDown={e => e.key==="Enter"&&go()} style={{ fontSize: 16 }} /></div>
          {err && <div style={{ color: "var(--danger)", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={go} disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
          <div className="divider" />
          <div style={{ fontSize: ".72rem", color: "var(--text3)", textAlign: "center", lineHeight: 1.8 }}>Contact your administrator if you forgot your password.</div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ bills, tasks, workers, vendors, totalRevenue, totalPending, paidBills, unpaidBills, pendingTasks, completedTasks, setPage, brand }) {
  const stats = [
    { label: "Total Orders", value: bills.length, icon: "billing", c1: "#4f67ff", c2: "#7c3aed", sub: "All time" },
    { label: "Pending Tasks", value: pendingTasks.length, icon: "tasks", c1: "#f59e0b", c2: "#ef4444", sub: `${completedTasks.length} completed` },
    { label: "Revenue Received", value: fmtCur(totalRevenue), icon: "payment", c1: "#10b981", c2: "#059669", sub: `${paidBills.length} paid` },
    { label: "Pending Payment", value: fmtCur(totalPending), icon: "chart", c1: "#ef4444", c2: "#dc2626", sub: `${unpaidBills.length} bills due` },
    { label: "Total Customers", value: bills.reduce((set, b) => (b.customer ? set.add(b.customer) : set), new Set()).size, icon: "customers", c1: "#8b5cf6", c2: "#6d28d9", sub: "Registered" },
    { label: "Completed Tasks", value: completedTasks.length, icon: "check", c1: "#06b6d4", c2: "#0891b2", sub: "This month" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        {brand.logo && <img src={brand.logo} alt="logo" style={{ height: 44, borderRadius: 8, objectFit: "contain" }} />}
        <div><div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{brand.shopName}</div><div style={{ fontSize: ".72rem", color: "var(--text3)" }}>{brand.address}</div></div>
      </div>
      <div className="quick-actions">
        <button className="btn btn-primary" onClick={() => setPage("billing")}><Icon name="plus" size={14} />Create Bill</button>
        <button className="btn btn-ghost" onClick={() => setPage("tasks")}><Icon name="tasks" size={14} />Assign Task</button>
        <button className="btn btn-ghost" onClick={() => setPage("reports")}><Icon name="chart" size={14} />Reports</button>
        <button className="btn btn-ghost" onClick={() => setPage("settings")}><Icon name="settings" size={14} />Settings</button>
      </div>
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-card" style={{ "--c1": s.c1, "--c2": s.c2 }}>
            <div style={{ marginBottom: 8 }}><Icon name={s.icon} size={22} color={s.c1} /></div>
            <div className="stat-value" style={{ fontSize: typeof s.value === "string" && s.value.length > 8 ? "1.05rem" : "1.5rem" }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-title">Recent Bills</div>
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {[...bills].reverse().slice(0, 5).map(b => <tr key={b.id}><td><div style={{ fontWeight: 600, fontSize: ".82rem" }}>{b.customer}</div><div style={{ fontSize: ".68rem", color: "var(--text3)" }}>{b.id}</div></td><td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.total)}</td><td><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"Paid":"Unpaid"}</span></td></tr>)}
          </tbody></table></div>
        </div>
        <div className="card">
          <div className="card-title">Recent Tasks</div>
          <div className="table-wrap"><table><thead><tr><th>Task</th><th>Worker</th><th>Status</th></tr></thead><tbody>
            {[...tasks].reverse().slice(0, 5).map(t => { const sc = t.status==="Completed"?"badge-green":t.status==="In Progress"?"badge-blue":"badge-yellow"; return <tr key={t.id}><td style={{ fontWeight: 600 }}>{t.title}</td><td style={{ fontSize: ".78rem", color: "var(--text2)" }}>{t.worker ? (workers.find(w=>w.id===t.worker)?.name||t.worker) : (vendors?.find(v=>v.id===t.vendor)?.name||t.vendor||"—")}</td><td><span className={`badge ${sc}`}>{t.status}</span></td></tr>; })}
          </tbody></table></div>
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({ brand, setBrand, showToast, adminPassword, changeAdminPassword, workers, setWorkers, user }) {
  const [f, setF] = useState({ ...brand });
  useEffect(() => { setF({ ...brand }); }, [brand]);
  const logoRef = useRef(); const qrRef = useRef();
  const [passForm, setPassForm] = useState({ current:"", newPass:"", confirm:"" });
  const [passErr, setPassErr] = useState("");

  const changeMyPassword = async () => {
    setPassErr("");
    if (!passForm.current || !passForm.newPass || !passForm.confirm) return setPassErr("All fields required.");
    if (passForm.newPass !== passForm.confirm) return setPassErr("New passwords don't match.");
    if (passForm.newPass.length < 4) return setPassErr("Password must be at least 4 characters.");
    if (user.role === "admin") {
      if (passForm.current !== adminPassword) return setPassErr("Current password is incorrect.");
      changeAdminPassword(passForm.newPass);
    } else {
      const worker = workers.find(w => w.id === user.id);
      if (!worker || passForm.current !== worker.password) return setPassErr("Current password is incorrect.");
      await db.updateWorkerPassword(user.id, passForm.newPass);
      setWorkers(ws => ws.map(w => w.id === user.id ? {...w, password: passForm.newPass} : w));
    }
    setPassForm({ current:"", newPass:"", confirm:"" });
    showToast("✅ Password changed successfully!");
  };

  const handleLogo = async (e) => { const file = e.target.files[0]; if (!file) return; setF(x => ({ ...x, logo: null })); const b64 = await readFile64(file); setF(x => ({ ...x, logo: b64 })); };
  const handleQr = async (e) => { const file = e.target.files[0]; if (!file) return; const b64 = await readFile64(file); setF(x => ({ ...x, paymentQr: b64, paymentQrLocked: false })); };
  const lockQr = () => { if (!f.paymentQr) return showToast("Upload a QR code first", "error"); setF(x => ({ ...x, paymentQrLocked: true })); showToast("Payment QR is now locked permanently"); };
  const save = () => { setBrand(f); showToast("Settings saved successfully"); };

  return (
    <div style={{ maxWidth: 740 }}>
      {/* ── Change Password Card (always visible at top) ── */}
      <div className="card" style={{ marginBottom: 20, borderLeft: "4px solid var(--accent)" }}>
        <div className="set-sec-title">🔑 Change My Password</div>
        <div className="form-grid" style={{ maxWidth: 480 }}>
          <div className="form-group full"><label>Current Password</label><input type="password" value={passForm.current} onChange={e=>setPassForm({...passForm,current:e.target.value})} placeholder="Enter current password" /></div>
          <div className="form-group"><label>New Password</label><input type="password" value={passForm.newPass} onChange={e=>setPassForm({...passForm,newPass:e.target.value})} placeholder="New password" /></div>
          <div className="form-group"><label>Confirm New Password</label><input type="password" value={passForm.confirm} onChange={e=>setPassForm({...passForm,confirm:e.target.value})} placeholder="Confirm new password" /></div>
        </div>
        {passErr && <div style={{ color:"var(--danger)", fontSize:".8rem", marginTop:8 }}>{passErr}</div>}
        <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={changeMyPassword}><Icon name="lock" size={13}/>Update Password</button>
      </div>

      <div className="card">

        {/* ── Logo & Branding ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">🖼 Logo & Branding</div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", marginBottom: 8 }}>Company Logo</label>
              <div className="upload-box" style={{ width: 120, height: 120 }} onClick={() => logoRef.current.click()}>
                {f.logo ? <img src={f.logo} alt="logo" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 6 }} />
                  : <><Icon name="upload" size={24} color="var(--text3)" /><span style={{ fontSize: ".7rem", color: "var(--text3)" }}>Click to upload</span></>}
              </div>
              <input ref={logoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogo} />
              {f.logo && <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => setF(x => ({ ...x, logo: null }))}>Remove</button>}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="form-group mb-3">
                <label>Shop / Company Name</label>
                <input value={f.shopName} onChange={e => setF(x => ({ ...x, shopName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Invoice Number Prefix</label>
                <input value={f.invoicePrefix} onChange={e => setF(x => ({ ...x, invoicePrefix: e.target.value.toUpperCase().replace(/\s/g,"") }))} maxLength={6} />
                <span style={{ fontSize: ".68rem", color: "var(--text3)" }}>Preview: {f.invoicePrefix}-{String(f.invoiceCounter).padStart(4,"0")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="divider" />

        {/* ── Contact Details ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">📞 Contact Details (auto-appear on every invoice)</div>
          <div className="form-grid">
            <div className="form-group full"><label>Address</label><textarea value={f.address} onChange={e => setF(x => ({ ...x, address: e.target.value }))} rows={2} style={{ minHeight: 52 }} /></div>
            <div className="form-group"><label>Phone Number</label><input value={f.phone} onChange={e => setF(x => ({ ...x, phone: e.target.value }))} placeholder="+91-XXXXX-XXXXX" /></div>
            <div className="form-group"><label>WhatsApp Number (with country code)</label><input value={f.whatsapp} onChange={e => setF(x => ({ ...x, whatsapp: e.target.value }))} placeholder="919876543210" /></div>
            <div className="form-group full"><label>Gmail / Email Address</label><input value={f.gmail} onChange={e => setF(x => ({ ...x, gmail: e.target.value }))} placeholder="yourshop@gmail.com" /></div>
          </div>
        </div>

        <div className="divider" />

        {/* ── Payment QR ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">💳 Payment QR Code — Fixed & Lockable</div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              {f.paymentQr
                ? <img src={f.paymentQr} alt="QR" style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 10, border: f.paymentQrLocked ? "2px solid var(--success)" : "2px solid var(--border)" }} />
                : <div className="upload-box" style={{ width: 120, height: 120 }} onClick={() => !f.paymentQrLocked && qrRef.current.click()}>
                    <Icon name="lock" size={24} color="var(--text3)" /><span style={{ fontSize: ".7rem", color: "var(--text3)" }}>Upload QR</span>
                  </div>}
              {f.paymentQrLocked && <div className="lock-badge"><Icon name="lock" size={10} />Locked</div>}
              <input ref={qrRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleQr} />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: ".82rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
                Upload your UPI / payment QR code. Once you click <strong>Lock QR</strong>, it cannot be changed by anyone (including workers).
                It will auto-appear on every invoice.
              </p>
              {!f.paymentQrLocked && !f.paymentQr && <button className="btn btn-ghost btn-sm" onClick={() => qrRef.current.click()}><Icon name="upload" size={13} />Upload QR Image</button>}
              {!f.paymentQrLocked && f.paymentQr && (
                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => qrRef.current.click()}><Icon name="upload" size={13} />Replace QR</button>
                  <button className="btn btn-warning btn-sm" onClick={lockQr}><Icon name="lock" size={13} />Lock QR (Permanent)</button>
                </div>
              )}
              {f.paymentQrLocked && <div style={{ fontSize: ".78rem", color: "var(--success)", fontWeight: 600 }}>✓ QR is locked. It will auto-show on all invoices.</div>}
            </div>
          </div>
          <div style={{ marginTop: 16, padding: 14, background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: ".85rem" }}>UPI ID for amount-specific QR (recommended)</div>
            <p style={{ fontSize: ".78rem", color: "var(--text2)", marginBottom: 10, lineHeight: 1.5 }}>
              Add your UPI ID (e.g. 91xxxxxxxxxx@ybl or merchant@paytm). Each invoice will show a QR with the exact bill amount—non-editable, like a payment gateway.
            </p>
            <input value={f.upiId || ""} onChange={e => setF(x => ({ ...x, upiId: e.target.value.trim() }))} placeholder="91xxxxxxxxxx@ybl or name@paytm" style={{ width: "100%", maxWidth: 320, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: ".85rem" }} />
          </div>
        </div>

        <div className="divider" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setF({ ...brand })}>Discard Changes</button>
          <button className="btn btn-primary" onClick={save}><Icon name="check" size={14} />Save Settings</button>
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp Auto-Send Preview Modal ─────────────────────────────────────────
function WaPreviewModal({ bill, brand, onSend, onSkip }) {
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const payLink = `${window.location.origin}?pay=${bill.id}`;
  const payQrLink = qrImgUrl(
    brand.paymentQr ? `Pay ${fmtCur(bill.total)} to ${brand.shopName}` : invLink,
    160
  );

  // One invoice link, one pay link (pay link shows QR only, no login)
  const waMsg = [
    `*Invoice from ${brand.shopName}*`,
    ``,
    `Hi ${bill.customer || "Customer"},`,
    ``,
    `Your invoice is ready.`,
    ``,
    `*Invoice No:* ${bill.id}`,
    ...((bill.items && bill.items.length > 0) ? bill.items.map((it, i) => `*${i+1}.* ${it.desc}${it.size ? ` (${it.size})` : ""} – Qty: ${it.qty} × ${fmtCur(it.rate)}`) : [`*Work:* ${bill.desc}${bill.size ? " (" + bill.size + ")" : ""}`, `*Qty:* ${bill.qty}  |  *Rate:* ${fmtCur(bill.rate)}`]),
    bill.gst ? `*GST (18%):* ${fmtCur(bill.gstAmt)}` : null,
    `*Total:* ${fmtCur(bill.total)}`,
    ``,
    bill.paid ? "✅ *Status:* PAID" : "⏳ *Status:* PAYMENT PENDING",
    ``,
    `📄 *View Invoice:* ${invLink}`,
    `💳 *Pay Now (QR):* ${payLink}`,
    ``,
    `Thank you,`,
    `${brand.shopName}`,
    brand.phone ? `Phone: ${brand.phone}` : null,
  ].filter(l => l !== null).join("\n");

  const openWa = () => {
    const num = bill.phone ? bill.phone.replace(/\D/g, "") : brand.whatsapp;
    const target = num.startsWith("91") || num.length >= 12 ? num : `91${num}`;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(waMsg)}`, "_blank");
    onSend();
  };

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(waMsg);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = waMsg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 40, height: 40, background: "#25D366", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="whatsapp" size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem" }}>Send Invoice via WhatsApp</div>
            <div style={{ fontSize: ".72rem", color: "var(--text3)" }}>Bill created ✓ — Preview &amp; send to customer</div>
          </div>
        </div>

        {/* Amount highlight */}
        <div style={{ background: "linear-gradient(135deg,#25D366,#128C7E)", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "rgba(255,255,255,.8)", fontSize: ".72rem", fontWeight: 600 }}>TOTAL AMOUNT</div>
            <div style={{ color: "#fff", fontSize: "1.8rem", fontWeight: 900, fontFamily: "var(--mono)", lineHeight: 1.1 }}>{fmtCur(bill.total)}</div>
            <div style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem", marginTop: 3 }}>{bill.id} · {bill.customer}</div>
          </div>
          {/* Payment QR shown in the card */}
          {brand.paymentQr ? (
            <div style={{ textAlign: "center" }}>
              <img src={brand.paymentQr} alt="Pay QR" style={{ width: 72, height: 72, borderRadius: 8, background: "#fff", padding: 3 }} />
              <div style={{ color: "rgba(255,255,255,.8)", fontSize: ".58rem", marginTop: 3 }}>Scan to Pay</div>
            </div>
          ) : (
            <div style={{ textAlign: "center", opacity: .6 }}>
              <img src={payQrLink} alt="QR" style={{ width: 72, height: 72, borderRadius: 8, background: "#fff", padding: 3 }} onError={e => e.target.style.display="none"} />
              <div style={{ color: "rgba(255,255,255,.8)", fontSize: ".58rem", marginTop: 3 }}>Invoice Link</div>
            </div>
          )}
        </div>

        {/* Message preview */}
        <div style={{ background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: 10, padding: 14, marginBottom: 16, position: "relative" }}>
          <div style={{ fontSize: ".65rem", fontWeight: 700, color: "#388e3c", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".06em" }}>WhatsApp Message Preview</div>
          <pre style={{ fontSize: ".75rem", color: "#1b5e20", whiteSpace: "pre-wrap", fontFamily: "var(--font)", lineHeight: 1.55, maxHeight: 180, overflowY: "auto" }}>{waMsg}</pre>
          {/* WA bubble tail */}
          <div style={{ position: "absolute", bottom: -8, right: 20, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "0px solid transparent", borderTop: "8px solid #c8e6c9" }} />
        </div>

        {/* Sending to */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "8px 12px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: ".8rem" }}>
          <Icon name="whatsapp" size={14} color="#25D366" />
          <span style={{ color: "var(--text2)" }}>Sending to:</span>
          <span style={{ fontWeight: 700, fontFamily: "var(--mono)", color: "var(--text)" }}>
            {bill.phone ? `+${bill.phone.replace(/\D/g,"").replace(/^(?!91)/,"91")}` : `+${brand.whatsapp}`}
          </span>
          <span style={{ fontSize: ".68rem", color: "var(--text3)" }}>({bill.customer})</span>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost flex-1" style={{ justifyContent: "center" }} onClick={copyMsg}>
            Copy Message
          </button>
          <button className="btn btn-ghost flex-1" style={{ justifyContent: "center" }} onClick={onSkip}>
            Skip for Now
          </button>
          <button className="btn btn-wa flex-1" style={{ justifyContent: "center", fontSize: ".9rem", padding: "10px 20px" }} onClick={openWa}>
            <Icon name="whatsapp" size={16} /> Send on WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Billing ───────────────────────────────────────────────────────────────────
function BillingPage({ bills, setBills, showToast, customers, setCustomers, brand, setBrand }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState(""); const [filterDate, setFilterDate] = useState("");
  const [invoiceView, setInvoiceView] = useState(null);
  const [waPreview, setWaPreview] = useState(null); // bill to preview in WA modal
  const [form, setForm] = useState({
    customer: "", phone: "", email: "",
    items: [{ desc: "", size: "", qty: 1, rate: 0 }],
    gst: false, paid: false,
  });

  const subtotal = (form.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const gstAmt = form.gst ? subtotal * 0.18 : 0;
  const total = subtotal + gstAmt;

  const addItem = () => setForm(f => ({ ...f, items: [...(f.items || []), { desc: "", size: "", qty: 1, rate: 0 }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: (f.items || []).filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, val) => setForm(f => ({
    ...f,
    items: (f.items || []).map((it, i) => i === idx ? { ...it, [field]: val } : it),
  }));

  // When typing a phone number, auto-fill customer name/email if we already know this customer
  const handlePhoneChange = (value) => {
    const existing = customers.find(c => c.phone === value);
    if (existing) {
      setForm(f => ({
        ...f,
        phone: value,
        customer: f.customer || existing.name,
        email: f.email || existing.email || "",
      }));
    } else {
      setForm(f => ({ ...f, phone: value }));
    }
  };

  const createBill = async () => {
    const validItems = (form.items || []).filter(i => (i.desc || "").trim());
    if (!form.customer || validItems.length === 0) return showToast("Customer name and at least one item description required", "error");
    const id = genInvId(brand);
    const items = validItems.map(i => ({ desc: i.desc, size: i.size || "", qty: Number(i.qty) || 1, rate: Number(i.rate) || 0 }));
    const bill = { id, customer: form.customer, phone: form.phone, email: form.email, items, subtotal, gstAmt, total, gst: form.gst, paid: form.paid, createdAt: now() };
    // Save to Supabase
    const saved = await db.addBill(bill);
    if (saved) {
      setBills(b => [saved, ...b]);
      setBrand(br => ({ ...br, invoiceCounter: br.invoiceCounter + 1 }));
    } else {
      setBills(b => [bill, ...b]); // fallback to local
    }
    if (!customers.find(c => c.phone === form.phone)) {
      const newCust = { id: "C" + Date.now(), name: form.customer, phone: form.phone, email: form.email, createdAt: now() };
      await db.addCustomer(newCust);
      setCustomers(c => [newCust, ...c]);
    }
    setShowModal(false);
    setForm({ customer: "", phone: "", email: "", items: [{ desc: "", size: "", qty: 1, rate: 0 }], gst: false, paid: false });
    showToast("✅ Bill created: " + id);
    // ── Auto-trigger WhatsApp preview ──
    setWaPreview(bill);
  };

  const togglePaid = async (id) => {
    const bill = bills.find(b => b.id === id);
    if (!bill) return;
    const newPaid = !bill.paid;
    setBills(b => b.map(x => x.id === id ? { ...x, paid: newPaid } : x));
    await db.updateBillPaid(id, newPaid);
    showToast("Payment status updated");
  };
  const deleteBill = async (id) => {
    setBills(b => b.filter(x => x.id !== id));
    await db.deleteBill(id);
    showToast("Bill deleted", "error");
  };

  const filtered = bills.filter(b => {
    const q = search.toLowerCase();
    return (!q || (b.customer||"").toLowerCase().includes(q) || (b.id||"").toLowerCase().includes(q) || (b.desc||"").toLowerCase().includes(q))
      && (!filterDate || b.createdAt.startsWith(filterDate));
  });

  const shareWa = (b) => {
    setWaPreview(b);
  };
  const shareGmail = (b) => {
    const link = `${window.location.origin}?inv=${b.id}`;
    const sub = `Invoice from ${brand.shopName} — ${b.id}`;
    const body = `Dear ${b.customer},\n\nYour invoice ${b.id} of ${fmtCur(b.total)} from ${brand.shopName} is ready.\n\nView online: ${link}\n\nThank you!\n\n${brand.shopName}\n${brand.phone}\n${brand.address}`;
    window.open(`mailto:${b.email || ""}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="flex gap-2 items-center" style={{ flex: 1, flexWrap: "wrap" }}>
          <div className="search-bar" style={{ flex: 1, maxWidth: 280 }}>
            <Icon name="search" size={14} color="var(--text3)" />
            <input placeholder="Search bills…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ width: 150, padding: "7px 10px", fontSize: ".82rem" }} />
          {filterDate && <button className="btn btn-sm btn-ghost" onClick={() => setFilterDate("")}>Clear</button>}
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />New Bill</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Description</th><th>Qty</th><th>Total</th><th>GST</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills found</td></tr>}
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="font-mono" style={{ fontWeight: 700, color: "var(--accent)", fontSize: ".78rem" }}>{b.id}</td>
                  <td><div style={{ fontWeight: 600 }}>{b.customer}</div><div style={{ fontSize: ".68rem", color: "var(--text3)" }}>{b.phone}</div></td>
                  <td><div style={{ fontSize: ".8rem" }}>{(b.items && b.items.length > 1) ? `${b.items.length} items` : (b.items?.[0]?.desc || b.desc)}</div><div style={{ fontSize: ".68rem", color: "var(--text3)" }}>{b.items?.[0]?.size || b.size}</div></td>
                  <td className="font-mono">{(b.items && b.items.length > 0) ? b.items.reduce((s,i)=>s+(i.qty||0),0) : b.qty}</td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.total)}</td>
                  <td><span className={`badge ${b.gst?"badge-blue":"badge-purple"}`}>{b.gst?"18%":"None"}</span></td>
                  <td><button onClick={() => togglePaid(b.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"✓ Paid":"Unpaid"}</span></button></td>
                  <td style={{ fontSize: ".72rem", color: "var(--text3)" }}>{fmtDate(b.createdAt)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-ghost" title="View Invoice" onClick={() => setInvoiceView(b)}><Icon name="billing" size={12} /></button>
                      <button className="btn btn-sm btn-wa" title="WhatsApp" onClick={() => shareWa(b)}><Icon name="whatsapp" size={12} /></button>
                      <button className="btn btn-sm btn-gmail" title="Send via Gmail" onClick={() => shareGmail(b)}><Icon name="mail" size={12} /></button>
                      <button className="btn btn-sm btn-danger" title="Delete" onClick={() => deleteBill(b.id)}><Icon name="trash" size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Bill Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Create New Bill</div>
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", fontSize: ".78rem", color: "var(--accent)", fontWeight: 700, fontFamily: "var(--mono)" }}>
              Auto Invoice #: {genInvId(brand)} — system generated, cannot be edited
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Customer Name *</label><input value={form.customer} onChange={e => setForm({...form,customer:e.target.value})} /></div>
              <div className="form-group"><label>Phone Number</label><input value={form.phone} onChange={e => handlePhoneChange(e.target.value)} /></div>
              <div className="form-group full"><label>Email Address</label><input type="email" value={form.email} onChange={e => setForm({...form,email:e.target.value})} placeholder="customer@email.com" /></div>
            </div>
            <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 700, fontSize: ".85rem" }}>Line Items</div>
            {(form.items || []).map((item, idx) => (
              <div key={idx} style={{ marginBottom: 12, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: ".75rem", fontWeight: 700, color: "var(--text2)" }}>Item {idx + 1}</span>
                  {(form.items || []).length > 1 && <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}><Icon name="trash" size={11} /></button>}
                </div>
                <div className="form-grid">
                  <div className="form-group full"><label>Description *</label><input value={item.desc} onChange={e => updateItem(idx, "desc", e.target.value)} placeholder="Print job…" /></div>
                  <div className="form-group"><label>Size</label><input value={item.size} onChange={e => updateItem(idx, "size", e.target.value)} placeholder="A4, 3.5×2″" /></div>
                  <div className="form-group"><label>Qty</label><input type="number" min={1} value={item.qty} onChange={e => updateItem(idx, "qty", +e.target.value)} /></div>
                  <div className="form-group"><label>Rate (₹)</label><input type="number" min={0} value={item.rate} onChange={e => updateItem(idx, "rate", +e.target.value)} /></div>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginBottom: 14 }} onClick={addItem}><Icon name="plus" size={14} /> Add another item</button>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Subtotal</label><input value={fmtCur(subtotal)} readOnly style={{ fontFamily:"var(--mono)", fontWeight:700, maxWidth: 140 }} /></div>
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <div className="toggle-wrap" onClick={() => setForm({...form,gst:!form.gst})}><button className={`toggle ${form.gst?"on":""}`} /><span className="toggle-label">GST 18%{form.gst?` (+${fmtCur(gstAmt)})`:"" }</span></div>
              <div className="toggle-wrap" onClick={() => setForm({...form,paid:!form.paid})}><button className={`toggle ${form.paid?"on":""}`} /><span className="toggle-label">Mark as Paid</span></div>
            </div>
            <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--text2)" }}>Total Amount</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "1.2rem", color: "var(--accent)" }}>{fmtCur(total)}</span>
            </div>
            {/* WhatsApp auto-send notice */}
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#e8f5e9", border: "1px solid #c8e6c9", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 8, fontSize: ".75rem", color: "#2e7d32" }}>
              <Icon name="whatsapp" size={14} color="#25D366" />
              <span>After generating, WhatsApp will open automatically to send the invoice to the customer.</span>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createBill}><Icon name="billing" size={14} />Generate &amp; Send</button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp auto-send preview */}
      {waPreview && (
        <WaPreviewModal
          bill={waPreview}
          brand={brand}
          onSend={() => { showToast("📲 Opening WhatsApp…", "success"); setWaPreview(null); }}
          onSkip={() => { showToast("WhatsApp skipped", "info"); setWaPreview(null); }}
        />
      )}

      {invoiceView && <InvoiceModal bill={invoiceView} brand={brand} onClose={() => setInvoiceView(null)} />}
    </div>
  );
}

// ── Professional Invoice Modal ─────────────────────────────────────────────────
function InvoiceModal({ bill, brand, onClose }) {
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);

  const handleWa = () => {
    const msg = `Dear ${bill.customer}, your invoice of ${fmtCur(bill.total)} is ready from ${brand.shopName}. Please check below.\n${invLink}`;
    window.open(`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const handleGmail = () => {
    const sub = `Invoice from ${brand.shopName} — ${bill.id}`;
    const body = `Dear ${bill.customer},\n\nYour invoice ${bill.id} of ${fmtCur(bill.total)} from ${brand.shopName} is ready.\n\nView online: ${invLink}\n\nThank you!\n\n${brand.shopName}\n${brand.phone}\n${brand.address}`;
    window.open(`mailto:${bill.email||""}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>

        {/* Action bar */}
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><Icon name="x" size={13} />Close</button>
          <button className="btn btn-sm btn-wa" onClick={handleWa}><Icon name="whatsapp" size={13} />WhatsApp</button>
          <button className="btn btn-sm btn-gmail" onClick={handleGmail}><Icon name="mail" size={13} />Gmail</button>
          <button className="btn btn-sm btn-primary" onClick={() => window.print()}><Icon name="download" size={13} />Print / PDF</button>
        </div>

        {/* ── Invoice Layout ── */}
        <div className="inv-wrap">

          {/* Header */}
          <div className="inv-header">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {brand.logo
                ? <img src={brand.logo} alt="logo" className="inv-logo" />
                : <div className="inv-logo-ph"><Icon name="printer" size={26} color="#fff" /></div>}
              <div>
                <div className="inv-shop-name">{brand.shopName}</div>
                <div className="inv-shop-details">
                  {brand.address}<br />
                  📞 {brand.phone}&nbsp;&nbsp;✉ {brand.gmail}<br />
                  💬 wa.me/+{brand.whatsapp}
                </div>
              </div>
            </div>
            <div className="inv-right">
              <div className="inv-title">Invoice</div>
              <div className="inv-meta">
                <strong style={{ color: "#4f67ff", fontSize: ".85rem" }}>{bill.id}</strong><br />
                Date: {fmtDate(bill.createdAt)}<br />
                <br />
                <strong>Bill To:</strong><br />
                {bill.customer}<br />
                {bill.phone}{bill.email ? <><br />{bill.email}</> : null}
              </div>
            </div>
          </div>

          {/* Bill-to detail boxes */}
          <div className="inv-bill-row">
            <div className="inv-bill-box">
              <div className="inv-lbl">Items</div>
              <div className="inv-val">{(bill.items && bill.items.length > 0) ? `${bill.items.length} item(s)` : "1 item"}</div>
            </div>
            <div className="inv-bill-box">
              <div className="inv-lbl">Payment Status</div>
              <div><span className={`inv-status ${bill.paid?"inv-paid":"inv-unpaid"}`}>{bill.paid?"✓ PAID":"⚠ UNPAID"}</span></div>
            </div>
          </div>

          {/* Items table */}
          <table className="inv-table">
            <thead>
              <tr><th>#</th><th>Item / Description</th><th>Size</th><th style={{ textAlign:"right" }}>Qty</th><th style={{ textAlign:"right" }}>Rate</th><th style={{ textAlign:"right" }}>Amount</th></tr>
            </thead>
            <tbody>
              {((bill.items && bill.items.length > 0) ? bill.items : [{ desc: bill.desc, size: bill.size, qty: bill.qty||1, rate: bill.rate||0 }]).map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.desc}</td>
                  <td>{it.size || "—"}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace" }}>{it.qty}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace" }}>{fmtCur(it.rate)}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{fmtCur((it.qty||0)*(it.rate||0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="inv-totals">
            <div className="inv-totals-box">
              <div className="inv-total-row"><span>Subtotal</span><span style={{ fontFamily:"monospace" }}>{fmtCur(bill.subtotal)}</span></div>
              {bill.gst && <div className="inv-total-row"><span>GST (18%)</span><span style={{ fontFamily:"monospace" }}>{fmtCur(bill.gstAmt)}</span></div>}
              <div className="inv-grand"><span>Total Due</span><span>{fmtCur(bill.total)}</span></div>
            </div>
          </div>

          {/* Footer: thank you + QR codes + Tap to Pay */}
          <div className="inv-footer">
            <div>
              <div style={{ fontStyle: "italic", fontSize: ".72rem", color: "#9ca3af" }}>Thank you for your business!</div>
              <div style={{ fontWeight: 700, color: "#4f67ff", marginTop: 4 }}>{brand.shopName}</div>
              <div style={{ fontSize: ".7rem", color: "#9ca3af" }}>{brand.phone}</div>
            </div>
            <div className="inv-qr-group">
              <div style={{ textAlign: "center" }}>
                <img src={invQR} alt="inv-qr" width={90} height={90} style={{ borderRadius: 6, border: "1px solid #e4e8f0" }} onError={e => e.target.style.display="none"} />
                <div className="inv-qr-label">Scan to view<br />invoice online</div>
              </div>
              {(brand.upiId && brand.upiId.trim()) || brand.paymentQr ? (
                <div style={{ textAlign: "center" }}>
                  <img
                    src={brand.upiId && brand.upiId.trim()
                      ? qrImgUrl(upiIntentUrl(bill.total, brand.upiId, brand.shopName), 90)
                      : (brand.paymentQr && typeof brand.paymentQr === "string" && brand.paymentQr.startsWith("/") ? `${window.location.origin}${brand.paymentQr}` : brand.paymentQr)}
                    alt="pay-qr"
                    width={90}
                    height={90}
                    style={{ borderRadius: 6, border: "2px solid #10b981" }}
                    onError={e => e.target.style.display="none"}
                  />
                  <div className="inv-qr-label">Scan to<br />Pay {fmtCur(bill.total)}</div>
                </div>
              ) : null}
            </div>
          </div>
          {((brand.upiId && brand.upiId.trim()) || brand.paymentQr) && (
            <div style={{ marginTop: 12, textAlign: "center" }} className="no-print">
              <a href={`${window.location.origin}?pay=${bill.id}`} style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
                <button type="button" style={{ padding: "12px 24px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, fontSize: ".9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,.3)" }}>
                  📱 Tap to Pay {fmtCur(bill.total)}
                </button>
              </a>
              <div style={{ fontSize: ".65rem", color: "#6b7280", marginTop: 6 }}>Opens secure payment page</div>
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #e4e8f0", fontSize: ".62rem", color: "#9ca3af", textAlign: "center" }}>
            This is a computer-generated invoice. No signature required. &nbsp;|&nbsp; {brand.shopName} &nbsp;|&nbsp; {brand.phone}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pay QR Page (no login, QR only, amount-specific) ───────────────────────────
function PayQRPage({ invId }) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);

  useEffect(() => {
    async function load() {
      const [b, br] = await Promise.all([
        typeof db.getBillById === "function" ? db.getBillById(invId) : null,
        db.loadBrand(DEFAULT_BRAND),
      ]);
      if (b) setBill(b);
      if (br) setBrandLocal(br);
      setLoading(false);
    }
    load();
  }, [invId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ padding: 24 }}>Loading…</div>
      </div>
    );
  }
  if (!bill) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Invoice not found</div>
          <div style={{ fontSize: ".8rem", color: "var(--text3)" }}>Invalid or deleted invoice.</div>
        </div>
      </div>
    );
  }

  const amount = bill.total || 0;
  const hasUpi = brand.upiId && brand.upiId.trim();
  const qrData = hasUpi ? upiIntentUrl(amount, brand.upiId, brand.shopName) : null;
  const qrImg = qrData ? qrImgUrl(qrData, 220) : (brand.paymentQr ? (brand.paymentQr.startsWith("/") ? `${window.location.origin}${brand.paymentQr}` : brand.paymentQr) : null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#10b981,#059669)", padding: 24 }}>
      <div className="card" style={{ maxWidth: 360, textAlign: "center", padding: 28 }}>
        <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--accent)", marginBottom: 8 }}>{brand.shopName}</div>
        <div style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 20 }}>{bill.id} · {bill.customer}</div>
        <div style={{ background: "var(--accent-soft)", borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
          <div style={{ fontSize: ".72rem", color: "var(--text2)", marginBottom: 4 }}>Pay Amount</div>
          <div style={{ fontSize: "2rem", fontWeight: 900, fontFamily: "var(--mono)", color: "var(--accent)" }}>{fmtCur(amount)}</div>
          {hasUpi && <div style={{ fontSize: ".68rem", color: "var(--success)", marginTop: 6 }}>Amount fixed in QR (non-editable)</div>}
        </div>
        {qrImg ? (
          hasUpi ? (
            <a href={qrData} style={{ display: "block", marginBottom: 16, textDecoration: "none" }} title="Tap to open UPI app">
              <img src={qrImg} alt="Pay QR" style={{ width: 200, height: 200, borderRadius: 12, background: "#fff", padding: 10, margin: "0 auto", display: "block", cursor: "pointer" }} />
            </a>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <img src={qrImg} alt="Pay QR" style={{ width: 200, height: 200, borderRadius: 12, background: "#fff", padding: 10, margin: "0 auto", display: "block" }} />
            </div>
          )
        ) : (
          <div style={{ padding: 40, background: "var(--surface2)", borderRadius: 12, marginBottom: 16, color: "var(--text3)", fontSize: ".85rem" }}>Add UPI ID in Settings for QR</div>
        )}
        {hasUpi && (
          <>
            <a href={qrData} style={{ display: "block", textDecoration: "none", marginBottom: 8 }}>
              <button type="button" style={{ width: "100%", padding: "14px 24px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 12, fontSize: "1rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,.4)", WebkitTapHighlightColor: "transparent" }}>
                📱 Tap to Pay {fmtCur(amount)}
              </button>
            </a>
            <div style={{ fontSize: ".7rem", color: "var(--text3)", marginBottom: 8 }}>Opens PhonePe, Paytm, GPay or any UPI app. If it doesn’t open, scan the QR above.</div>
          </>
        )}
        <div style={{ fontSize: ".78rem", color: "var(--text2)" }}>{hasUpi ? "Amount is fixed — safe to pay" : "Scan with any UPI app to pay"}</div>
      </div>
    </div>
  );
}

// ── Public Invoice Page (no login required) ────────────────────────────────────
function PublicInvoicePage({ invId }) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);

  useEffect(() => {
    async function load() {
      const [b, br] = await Promise.all([
        typeof db.getBillById === "function" ? db.getBillById(invId) : null,
        db.loadBrand(DEFAULT_BRAND),
      ]);
      if (b) setBill(b);
      if (br) setBrandLocal(br);
      setLoading(false);
    }
    load();
  }, [invId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Loading invoice…</div>
          <div style={{ fontSize: ".8rem", color: "var(--text3)" }}>Please wait while we fetch your bill.</div>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div className="card" style={{ padding: 24, maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: 8 }}>Invoice not found</div>
          <div style={{ fontSize: ".8rem", color: "var(--text3)" }}>The invoice link may be incorrect or has been deleted.</div>
        </div>
      </div>
    );
  }

  // Reuse Invoice layout content without modal overlay chrome
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#e5e7eb", padding: 16 }}>
      <div className="inv-wrap" style={{ maxWidth: 800, width: "100%" }}>
        {/* Header */}
        <div className="inv-header">
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {brand.logo
              ? <img src={brand.logo} alt="logo" className="inv-logo" />
              : <div className="inv-logo-ph"><Icon name="printer" size={26} color="#fff" /></div>}
            <div>
              <div className="inv-shop-name">{brand.shopName}</div>
              <div className="inv-shop-details">
                {brand.address}<br />
                📞 {brand.phone}&nbsp;&nbsp;✉ {brand.gmail}<br />
                💬 wa.me/+{brand.whatsapp}
              </div>
            </div>
          </div>
          <div className="inv-right">
            <div className="inv-title">Invoice</div>
            <div className="inv-meta">
              <strong style={{ color: "#4f67ff", fontSize: ".85rem" }}>{bill.id}</strong><br />
              Date: {fmtDate(bill.createdAt)}<br />
              <br />
              <strong>Bill To:</strong><br />
              {bill.customer}<br />
              {bill.phone}{bill.email ? <><br />{bill.email}</> : null}
            </div>
          </div>
        </div>

        {/* Bill-to detail boxes */}
        <div className="inv-bill-row">
          <div className="inv-bill-box">
            <div className="inv-lbl">Items</div>
            <div className="inv-val">{(bill.items && bill.items.length > 0) ? `${bill.items.length} item(s)` : "1 item"}</div>
          </div>
          <div className="inv-bill-box">
            <div className="inv-lbl">Payment Status</div>
            <div><span className={`inv-status ${bill.paid ? "inv-paid" : "inv-unpaid"}`}>{bill.paid ? "✓ PAID" : "⚠ UNPAID"}</span></div>
          </div>
        </div>

        {/* Items table */}
        <table className="inv-table">
          <thead>
            <tr><th>#</th><th>Item / Description</th><th>Size</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Rate</th><th style={{ textAlign: "right" }}>Amount</th></tr>
          </thead>
          <tbody>
            {((bill.items && bill.items.length > 0) ? bill.items : [{ desc: bill.desc, size: bill.size, qty: bill.qty||1, rate: bill.rate||0 }]).map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.desc}</td>
                <td>{it.size || "—"}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{it.qty}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtCur(it.rate)}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmtCur((it.qty||0)*(it.rate||0))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="inv-totals">
          <div className="inv-totals-box">
            <div className="inv-total-row"><span>Subtotal</span><span style={{ fontFamily: "monospace" }}>{fmtCur(bill.subtotal)}</span></div>
            {bill.gst && <div className="inv-total-row"><span>GST (18%)</span><span style={{ fontFamily: "monospace" }}>{fmtCur(bill.gstAmt)}</span></div>}
            <div className="inv-grand"><span>Total Due</span><span>{fmtCur(bill.total)}</span></div>
          </div>
        </div>

        {/* Footer: thank you + QR codes + Tap to Pay */}
        <div className="inv-footer">
          <div>
            <div style={{ fontStyle: "italic", fontSize: ".72rem", color: "#6b7280" }}>Thank you for your business!</div>
            <div style={{ fontWeight: 700, color: "#4f67ff", marginTop: 4 }}>{brand.shopName}</div>
            <div style={{ fontSize: ".7rem", color: "#6b7280" }}>{brand.phone}</div>
          </div>
          <div className="inv-qr-group">
            {/* Invoice link QR */}
            <div style={{ textAlign: "center" }}>
              <img src={invQR} alt="inv-qr" width={90} height={90} style={{ borderRadius: 6, border: "1px solid #e4e8f0" }} onError={e => e.target.style.display = "none"} />
              <div className="inv-qr-label">Scan to view<br />invoice online</div>
            </div>
            {/* Payment QR: amount-specific UPI (if upiId) or static image */}
            {(brand.upiId && brand.upiId.trim()) || brand.paymentQr ? (
              <div style={{ textAlign: "center" }}>
                <img
                  src={brand.upiId && brand.upiId.trim()
                    ? qrImgUrl(upiIntentUrl(bill.total, brand.upiId, brand.shopName), 90)
                    : (brand.paymentQr && typeof brand.paymentQr === "string" && brand.paymentQr.startsWith("/") ? `${window.location.origin}${brand.paymentQr}` : brand.paymentQr)}
                  alt="pay-qr"
                  width={90}
                  height={90}
                  style={{ borderRadius: 6, border: "2px solid #10b981" }}
                  onError={e => e.target.style.display = "none"}
                />
                <div className="inv-qr-label">Scan to<br />Pay {fmtCur(bill.total)}</div>
              </div>
            ) : null}
          </div>
        </div>
        {((brand.upiId && brand.upiId.trim()) || brand.paymentQr) && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <a href={`${window.location.origin}?pay=${bill.id}`} style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
              <button type="button" style={{ padding: "12px 24px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, fontSize: ".9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,.3)" }}>
                📱 Tap to Pay {fmtCur(bill.total)}
              </button>
            </a>
            <div style={{ fontSize: ".65rem", color: "#6b7280", marginTop: 6 }}>Opens secure payment page</div>
          </div>
        )}

        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #e4e8f0", fontSize: ".62rem", color: "#6b7280", textAlign: "center" }}>
          This is a computer-generated invoice. No signature required. &nbsp;|&nbsp; {brand.shopName} &nbsp;|&nbsp; {brand.phone}
        </div>
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function TasksPage({ tasks, setTasks, workers, vendors, showToast, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const firstWorkerId = workers[0]?.id ?? "";
  const firstVendorId = (vendors || [])[0]?.id ?? "";
  const [form, setForm] = useState({ title: "", customer: "", assigneeType: "worker", worker: firstWorkerId, vendor: firstVendorId, deadline: "", notes: "" });

  useEffect(() => {
    if (workers.length > 0 && form.assigneeType === "worker" && !workers.some(w => w.id === form.worker))
      setForm(f => ({ ...f, worker: workers[0].id }));
    if ((vendors || []).length > 0 && form.assigneeType === "vendor" && !(vendors || []).some(v => v.id === form.vendor))
      setForm(f => ({ ...f, vendor: vendors[0].id }));
  }, [workers, vendors, form.assigneeType]);

  const create = async () => {
    if (!form.title) return showToast("Task title required", "error");
    const assigneeId = form.assigneeType === "vendor" ? form.vendor : form.worker;
    if (!assigneeId) return showToast("Select a worker or vendor to assign", "error");
    const task = {
      id: "T" + Date.now().toString().slice(-4),
      status: "Pending",
      createdAt: now(),
      title: form.title,
      customer: form.customer,
      deadline: form.deadline,
      notes: form.notes,
      worker: form.assigneeType === "worker" ? assigneeId : null,
      vendor: form.assigneeType === "vendor" ? assigneeId : null,
    };
    const saved = await db.addTask(task);
    setTasks(t => [saved || task, ...t]);
    setShowModal(false);
    setForm({ title:"",customer:"",assigneeType:"worker",worker:workers[0]?.id??"",vendor:(vendors||[])[0]?.id??"",deadline:"",notes:"" });
    const assigneeName = form.assigneeType === "worker" ? (workers.find(w => w.id === assigneeId)?.name || "Worker") : (vendors?.find(v => v.id === assigneeId)?.name || "Vendor");
    addNotification(`Task "${form.title}" assigned to ${assigneeName}`);
    showToast("Task assigned successfully");
  };
  const chStatus = async (id, status) => {
    setTasks(t => t.map(x => x.id===id?{...x,status}:x));
    await db.updateTaskStatus(id, status);
    if(status==="Completed") addNotification("Task completed: "+tasks.find(t=>t.id===id)?.title);
    showToast("Status → "+status);
  };
  const del = async (id) => {
    setTasks(t => t.filter(x => x.id!==id));
    await db.deleteTask(id);
    showToast("Deleted","error");
  };
  const sc = s => s==="Completed"?"badge-green":s==="In Progress"?"badge-blue":"badge-yellow";
  const nowDate = new Date();
  const overdueTasks = tasks.filter(t => t.deadline && new Date(t.deadline) < nowDate && t.status !== "Completed");
  const filterOpts = [
    ["All", null, tasks.length],
    ["Pending", "Pending", tasks.filter(t=>t.status==="Pending").length],
    ["In Progress", "In Progress", tasks.filter(t=>t.status==="In Progress").length],
    ["Completed", "Completed", tasks.filter(t=>t.status==="Completed").length],
    ["Overdue", "overdue", overdueTasks.length],
    ["Incomplete", "incomplete", tasks.filter(t=>t.status!=="Completed").length],
  ];
  const [taskFilter, setTaskFilter] = useState("all");
  const filteredTasks = taskFilter === "all" ? tasks
    : taskFilter === "overdue" ? overdueTasks
    : taskFilter === "incomplete" ? tasks.filter(t => t.status !== "Completed")
    : tasks.filter(t => t.status === taskFilter);
  return (
    <div>
      <div className="flex justify-between mb-4" style={{ flexWrap:"wrap", gap:8 }}>
        <div className="flex" style={{ alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{fontSize:".75rem",fontWeight:600,color:"var(--text2)",marginRight:4}}>Filter:</span>
          <select value={taskFilter} onChange={e=>setTaskFilter(e.target.value)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",fontSize:".8rem",cursor:"pointer"}}>
            {filterOpts.map(([l,v,count])=><option key={l} value={v||"all"}>{l} ({count})</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14}/>Assign Task</button>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Task</th><th>Customer</th><th>Assigned To</th><th>Deadline</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {filteredTasks.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"var(--text3)",padding:32}}>No tasks match filter</td></tr>}
          {filteredTasks.map(t=>(
            <tr key={t.id}>
              <td><div style={{fontWeight:600}}>{t.title}</div><div style={{fontSize:".68rem",color:"var(--text3)",fontFamily:"var(--mono)"}}>{t.id}</div></td>
              <td>{t.customer||"—"}</td>
              <td>{t.worker ? (workers.find(w=>w.id===t.worker)?.name||t.worker) : (vendors?.find(v=>v.id===t.vendor)?.name||t.vendor||"—")}</td>
              <td style={{fontSize:".78rem",color:t.deadline&&new Date(t.deadline)<new Date()?"var(--danger)":"var(--text2)"}}>{t.deadline||"—"}</td>
              <td><span className={`badge ${sc(t.status)}`}>{t.status}</span></td>
              <td><div className="flex gap-2">
                {t.status!=="In Progress"&&t.status!=="Completed"&&<button className="btn btn-sm btn-ghost" onClick={()=>chStatus(t.id,"In Progress")}>Start</button>}
                {t.status!=="Completed"&&<button className="btn btn-sm btn-success" onClick={()=>chStatus(t.id,"Completed")}>Done</button>}
                <button className="btn btn-sm btn-danger" onClick={()=>del(t.id)}><Icon name="trash" size={12}/></button>
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
      {showModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal"><div className="modal-title">Assign New Task</div>
            <div className="form-grid">
              <div className="form-group full"><label>Task Title *</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} /></div>
              <div className="form-group"><label>Customer</label><input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} /></div>
              <div className="form-group"><label>Assign To</label><select value={form.assigneeType} onChange={e=>setForm({...form,assigneeType:e.target.value,worker:workers[0]?.id??"",vendor:(vendors||[])[0]?.id??""})}><option value="worker">Worker</option><option value="vendor">Vendor</option></select></div>
              <div className="form-group"><label>{form.assigneeType==="vendor"?"Vendor":"Worker"} *</label><select value={form.assigneeType==="vendor"?form.vendor:form.worker} onChange={e=>setForm({...form,[form.assigneeType]:e.target.value})}>{form.assigneeType==="vendor"?(vendors||[]).map(v=><option key={v.id} value={v.id}>{v.name} ({v.firm_name||v.username})</option>):workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
              <div className="form-group"><label>Deadline</label><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} /></div>
              <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Assign Task</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Workers ───────────────────────────────────────────────────────────────────
function WorkersPage({ workers, setWorkers, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [editPassModal, setEditPassModal] = useState(null); // worker being edited
  const [newPass, setNewPass] = useState("");
  const [form, setForm] = useState({ name:"", username:"", password:"" });
  const add = async () => {
    if(!form.name||!form.username||!form.password) return showToast("All fields required","error");
    if(workers.find(w=>w.username===form.username)) return showToast("Username already taken","error");

    // Insert without manually passing id — DB uses uuid default (gen_random_uuid)
    const saved = await db.addWorker({ role:"worker", ...form });

    if (saved) {
      setWorkers(w=>[...w, saved]);
    } else {
      // Fallback to local-only worker if DB insert fails
      const localWorker = { id:"local-"+Date.now(), role:"worker", ...form };
      setWorkers(w=>[...w, localWorker]);
    }
    setShowModal(false);
    setForm({name:"",username:"",password:""});
    showToast("Worker added");
  };
  const removeWorker = async (id) => {
    setWorkers(ws=>ws.filter(x=>x.id!==id));
    await db.deleteWorker(id);
    showToast("Removed","error");
  };
  const changePass = async () => {
    if(!newPass || newPass.length < 4) return showToast("Password must be at least 4 characters","error");
    const updated = {...editPassModal, password: newPass};
    await db.updateWorkerPassword(updated.id, newPass);
    setWorkers(ws=>ws.map(w=>w.id===updated.id?updated:w));
    setEditPassModal(null); setNewPass("");
    showToast("Worker password changed!");
  };
  return (
    <div>
      <div className="flex justify-between mb-4"><div style={{fontSize:".9rem",color:"var(--text2)"}}>{workers.length} workers</div><button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14}/>Add Worker</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14}}>
        {workers.map(w=>(
          <div key={w.id} className="card" style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",gap:10}}>
            <div className="u-av" style={{width:56,height:56,fontSize:"1.3rem"}}>{w.name[0]}</div>
            <div><div style={{fontWeight:700}}>{w.name}</div><div style={{fontSize:".75rem",color:"var(--text3)",fontFamily:"var(--mono)"}}>@{w.username}</div></div>
            <span className="badge badge-blue">Worker</span>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-ghost" onClick={()=>{setEditPassModal(w);setNewPass("");}}>🔑 Change Pass</button>
              <button className="btn btn-sm btn-danger" onClick={()=>removeWorker(w.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {showModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="modal"><div className="modal-title">Add New Worker</div>
            <div className="form-grid">
              <div className="form-group full"><label>Full Name *</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></div>
              <div className="form-group"><label>Username *</label><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} /></div>
              <div className="form-group"><label>Password *</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={add}>Add Worker</button></div>
          </div>
        </div>
      )}
      {editPassModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&(setEditPassModal(null),setNewPass(""))}>
          <div className="modal" style={{maxWidth:400}}><div className="modal-title">Change Password — {editPassModal.name}</div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Enter new password" autoFocus />
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>{setEditPassModal(null);setNewPass("");}}>Cancel</button><button className="btn btn-primary" onClick={changePass}>Save Password</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vendors ───────────────────────────────────────────────────────────────────
function VendorsPage({ vendors, setVendors, vendorBills, setVendorBills, showToast, brand }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", firmName: "", username: "", password: "", phone: "", email: "" });

  const add = async () => {
    if (!form.name || !form.username || !form.password) return showToast("Name, username and password required", "error");
    if (vendors.find(v => v.username === form.username)) return showToast("Username already taken", "error");
    try {
      const saved = await db.addVendor({ ...form, firmName: form.firmName });
      setVendors(v => [...v, saved]);
      setShowModal(false);
      setForm({ name: "", firmName: "", username: "", password: "", phone: "", email: "" });
      showToast("Vendor added! Share Vendor ID: " + saved.id);
    } catch (e) {
      showToast("Failed to save vendor: " + (e.message || "check console"), "error");
    }
  };

  const removeVendor = async (id) => {
    setVendors(v => v.filter(x => x.id !== id));
    await db.deleteVendor(id);
    showToast("Vendor removed", "error");
  };

  const toggleVendorBillPaid = async (id, paid) => {
    setVendorBills(b => b.map(x => x.id === id ? { ...x, paid } : x));
    await db.updateVendorBillPaid(id, paid);
    showToast(paid ? "Marked as paid" : "Marked as unpaid");
  };

  const getVendorName = (id) => vendors.find(v => v.id === id)?.name || id;

  return (
    <div>
      <div className="flex justify-between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: ".9rem", color: "var(--text2)" }}>{vendors.length} vendors</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />Add Vendor</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card">
          <div className="card-title">Vendors</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {vendors.map(v => (
              <div key={v.id} style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div><div style={{ fontWeight: 700 }}>{v.name}</div><div style={{ fontSize: ".72rem", color: "var(--text3)" }}>{v.firm_name || "—"}</div></div>
                  <span className="badge badge-purple">Vendor</span>
                </div>
                <div style={{ fontSize: ".72rem", fontFamily: "var(--mono)", color: "var(--accent)", marginBottom: 8 }}>ID: {v.id}</div>
                <div style={{ fontSize: ".75rem", color: "var(--text2)" }}>@{v.username}</div>
                <button className="btn btn-sm btn-danger" style={{ marginTop: 8 }} onClick={() => removeVendor(v.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Vendor Bills (What We Owe)</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Bill ID</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {vendorBills.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>No vendor bills yet</td></tr>}
              {vendorBills.map(b => (
                <tr key={b.id}>
                  <td className="font-mono" style={{ fontSize: ".78rem" }}>{b.id}</td>
                  <td>{getVendorName(b.vendor_id)}</td>
                  <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{(b.description || "").slice(0, 40)}{(b.description||"").length > 40 ? "…" : ""}</td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.amount)}</td>
                  <td><span className={`badge ${b.paid ? "badge-green" : "badge-red"}`}>{b.paid ? "Paid" : "Unpaid"}</span></td>
                  <td><button className={`btn btn-sm ${b.paid ? "btn-ghost" : "btn-success"}`} onClick={() => toggleVendorBillPaid(b.id, !b.paid)}>{b.paid ? "Mark Unpaid" : "Mark Paid"}</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal"><div className="modal-title">Add Vendor</div>
            <p style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 16 }}>Add a vendor and share their Vendor ID + login credentials so they can create bills for your company.</p>
            <div className="form-grid">
              <div className="form-group full"><label>Vendor Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Supplies" /></div>
              <div className="form-group full"><label>Firm / Company Name</label><input value={form.firmName} onChange={e => setForm({ ...form, firmName: e.target.value })} placeholder="Optional" /></div>
              <div className="form-group"><label>Username *</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Login username" /></div>
              <div className="form-group"><label>Password *</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Login password" /></div>
              <div className="form-group"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-group"><label>Email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={add}>Add Vendor</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vendor Dashboard ──────────────────────────────────────────────────────────
function VendorDashboard({ tasks, user, vendorBills }) {
  const myTasks = tasks.filter(t => t.vendor === user.id || t.vendor_id === user.id);
  const myBills = vendorBills.filter(b => b.vendor_id === user.id);
  const pendingBills = myBills.filter(b => !b.paid);
  const paidBills = myBills.filter(b => b.paid);

  return (
    <div>
      <div style={{ marginBottom: 20, fontSize: "1rem", fontWeight: 700 }}>Welcome, {user.name}! 👋</div>
      <div className="stats-grid">
        <div className="stat-card" style={{ "--c1": "#4f67ff", "--c2": "#7c3aed" }}><div className="stat-value">{myTasks.length}</div><div className="stat-label">My Tasks</div></div>
        <div className="stat-card" style={{ "--c1": "#f59e0b", "--c2": "#ef4444" }}><div className="stat-value">{myTasks.filter(t => t.status !== "Completed").length}</div><div className="stat-label">Pending Tasks</div></div>
        <div className="stat-card" style={{ "--c1": "#10b981", "--c2": "#059669" }}><div className="stat-value">{myBills.length}</div><div className="stat-label">My Bills</div></div>
        <div className="stat-card" style={{ "--c1": "#ef4444", "--c2": "#dc2626" }}><div className="stat-value">{fmtCur(pendingBills.reduce((s, b) => s + (b.amount || 0), 0))}</div><div className="stat-label">Outstanding</div></div>
      </div>
      <div className="card">
        <div className="card-title">Recent Bills Submitted</div>
        {myBills.length === 0 ? <div style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>No bills yet. Create one from the Create Bill tab.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>ID</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{myBills.slice(0, 10).map(b => (
              <tr key={b.id}><td className="font-mono">{b.id}</td><td>{(b.description||"").slice(0, 50)}</td><td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.amount)}</td><td><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"Paid":"Pending"}</span></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ── Vendor Tasks ──────────────────────────────────────────────────────────────
function VendorTasks({ tasks, setTasks, user, showToast, addNotification }) {
  const myTasks = tasks.filter(t => t.vendor === user.id || t.vendor_id === user.id);
  const upd = async (id, status) => {
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
    await db.updateTaskStatus(id, status);
    if (status === "Completed") addNotification("Task completed by vendor " + user.name + ": " + (tasks.find(t => t.id === id)?.title || ""));
    showToast(status === "Completed" ? "Task completed! Admin notified." : "Status updated");
  };
  const sc = s => s === "Completed" ? "badge-green" : s === "In Progress" ? "badge-blue" : "badge-yellow";
  return (
    <div>
      <div className="card"><div className="card-title">My Assigned Tasks</div>
        {myTasks.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>No tasks assigned to you yet</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myTasks.map(t => (
            <div key={t.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><div style={{ fontWeight: 700 }}>{t.title}</div><div style={{ fontSize: ".72rem", color: "var(--text3)", marginTop: 2 }}>{t.customer || "—"} · Deadline: {t.deadline || "Not set"}</div></div>
                <span className={`badge ${sc(t.status)}`}>{t.status}</span>
              </div>
              {t.notes && <div style={{ fontSize: ".78rem", color: "var(--text2)", marginBottom: 10 }}>{t.notes}</div>}
              <div className="flex gap-2">
                {t.status === "Pending" && <button className="btn btn-sm btn-primary" onClick={() => upd(t.id, "In Progress")}>Start</button>}
                {t.status === "In Progress" && <button className="btn btn-sm btn-success" onClick={() => upd(t.id, "Completed")}>Mark Completed ✓</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Vendor Bills Page (vendor creates bills for the company) ───────────────────
function VendorBillsPage({ vendorBills, setVendorBills, user, showToast, brand }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: "", amount: 0 });

  const create = async () => {
    if (!form.description || !form.amount || form.amount <= 0) return showToast("Description and amount required", "error");
    const id = "VB-" + Date.now().toString().slice(-6);
    const bill = { id, vendorId: user.id, description: form.description, amount: Number(form.amount), paid: false };
    const saved = await db.addVendorBill(bill);
    if (saved) {
      setVendorBills(b => [{ ...saved, vendor_id: user.id }, ...b]);
    } else {
      setVendorBills(b => [{ ...bill, vendor_id: user.id, createdAt: now() }, ...b]);
    }
    setShowModal(false);
    setForm({ description: "", amount: 0 });
    showToast("Bill submitted: " + id + " — ₹" + Number(form.amount).toLocaleString("en-IN"));
  };

  const myBills = vendorBills.filter(b => b.vendor_id === user.id);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <div style={{ fontSize: ".9rem", color: "var(--text2)" }}>Create bills for {brand?.shopName || "the company"} — amount you want to be paid</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />Submit Bill</button>
      </div>
      <div className="card">
        <div className="card-title">My Submitted Bills</div>
        <div className="table-wrap"><table>
          <thead><tr><th>Bill ID</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {myBills.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills yet. Click Submit Bill to create one.</td></tr>}
            {myBills.map(b => (
              <tr key={b.id}>
                <td className="font-mono" style={{ color: "var(--accent)", fontWeight: 700 }}>{b.id}</td>
                <td>{b.description || "—"}</td>
                <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.amount)}</td>
                <td><span className={`badge ${b.paid ? "badge-green" : "badge-yellow"}`}>{b.paid ? "Paid" : "Pending"}</span></td>
                <td style={{ fontSize: ".78rem", color: "var(--text2)" }}>{fmtDate(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal"><div className="modal-title">Submit Bill to Company</div>
            <p style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 16 }}>Enter the work/items and amount you want the company to pay you.</p>
            <div className="form-grid">
              <div className="form-group full"><label>Description *</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Printing 500 visiting cards, A4 offset" /></div>
              <div className="form-group"><label>Amount (₹) *</label><input type="number" min="0" step="0.01" value={form.amount || ""} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0" /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={create}>Submit Bill</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────
function PurchasesPage({ purchases, setPurchases, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ supplier: "", item: "", qty: 1, rate: 0, notes: "" });

  const total = (form.qty || 0) * (form.rate || 0);

  const createPurchase = async () => {
    if (!form.supplier || !form.item) return showToast("Supplier and item are required", "error");
    const purchase = {
      id: "P" + Date.now().toString().slice(-4),
      ...form,
      total,
      createdAt: now(),
    };
    const saved = await db.addPurchase(purchase);
    setPurchases(ps => [saved || purchase, ...ps]);
    setShowModal(false);
    setForm({ supplier: "", item: "", qty: 1, rate: 0, notes: "" });
    showToast("Purchase recorded");
  };

  const removePurchase = async (id) => {
    setPurchases(ps => ps.filter(p => p.id !== id));
    await db.deletePurchase(id);
    showToast("Purchase deleted", "error");
  };

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    return !q ||
      p.supplier?.toLowerCase().includes(q) ||
      p.item?.toLowerCase().includes(q) ||
      (p.id || "").toLowerCase().includes(q);
  });

  const totalSpend = purchases.reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: 480, marginBottom: 20 }}>
        <div className="stat-card" style={{ "--c1": "#f97316", "--c2": "#ea580c" }}>
          <div className="stat-value" style={{ fontSize: "1.05rem" }}>{fmtCur(totalSpend)}</div>
          <div className="stat-label">Total Purchase Spend</div>
        </div>
        <div className="stat-card" style={{ "--c1": "#4f67ff", "--c2": "#7c3aed" }}>
          <div className="stat-value" style={{ fontSize: "1.05rem" }}>{purchases.length}</div>
          <div className="stat-label">Purchase Entries</div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input placeholder="Search purchases…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />New Purchase</button>
      </div>

      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Purchase ID</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No purchases yet</td></tr>
          )}
          {filtered.map(p => (
            <tr key={p.id}>
              <td className="font-mono" style={{ fontWeight: 700, color: "var(--accent)", fontSize: ".78rem" }}>{p.id}</td>
              <td>{p.supplier}</td>
              <td>{p.item}</td>
              <td className="font-mono">{p.qty}</td>
              <td className="font-mono">{fmtCur(p.rate)}</td>
              <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(p.total)}</td>
              <td style={{ fontSize: ".72rem", color: "var(--text3)" }}>{p.createdAt ? fmtDate(p.createdAt) : "—"}</td>
              <td><button className="btn btn-sm btn-danger" onClick={() => removePurchase(p.id)}><Icon name="trash" size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Record New Purchase</div>
            <div className="form-grid">
              <div className="form-group"><label>Supplier *</label><input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
              <div className="form-group"><label>Item *</label><input value={form.item} onChange={e => setForm({ ...form, item: e.target.value })} /></div>
              <div className="form-group"><label>Quantity</label><input type="number" min={1} value={form.qty} onChange={e => setForm({ ...form, qty: +e.target.value })} /></div>
              <div className="form-group"><label>Rate (₹ per unit)</label><input type="number" min={0} value={form.rate} onChange={e => setForm({ ...form, rate: +e.target.value })} /></div>
              <div className="form-group full"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 14, padding: "12px 16px", background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600, color: "var(--text2)" }}>Total Amount</span>
              <span style={{ fontFamily: "var(--mono)", fontWeight: 800, fontSize: "1.1rem", color: "var(--accent)" }}>{fmtCur(total)}</span>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createPurchase}>Save Purchase</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────
function PaymentsPage({ bills, setBills, showToast }) {
  const [search, setSearch] = useState("");
  const paid = bills.filter(b=>b.paid); const unpaid = bills.filter(b=>!b.paid);
  const tPaid = paid.reduce((s,b)=>s+b.total,0); const tUnpaid = unpaid.reduce((s,b)=>s+b.total,0);
  const filtered = bills.filter(b=>!search||(b.customer||"").toLowerCase().includes(search.toLowerCase())||(b.id||"").toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="stats-grid" style={{gridTemplateColumns:"1fr 1fr 1fr",maxWidth:600,marginBottom:20}}>
        <div className="stat-card" style={{"--c1":"#10b981","--c2":"#059669"}}><div className="stat-value" style={{fontSize:"1.1rem"}}>{fmtCur(tPaid)}</div><div className="stat-label">Total Received</div></div>
        <div className="stat-card" style={{"--c1":"#ef4444","--c2":"#dc2626"}}><div className="stat-value" style={{fontSize:"1.1rem"}}>{fmtCur(tUnpaid)}</div><div className="stat-label">Outstanding</div></div>
        <div className="stat-card" style={{"--c1":"#4f67ff","--c2":"#7c3aed"}}><div className="stat-value" style={{fontSize:"1.05rem"}}>{fmtCur(tPaid+tUnpaid)}</div><div className="stat-label">Total Billed</div></div>
      </div>
      <div className="search-bar mb-4" style={{width:280}}><Icon name="search" size={14} color="var(--text3)"/><input placeholder="Search payments…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
        <tbody>{filtered.map(b=>(
          <tr key={b.id}>
            <td className="font-mono" style={{color:"var(--accent)",fontWeight:700,fontSize:".78rem"}}>{b.id}</td>
            <td style={{fontWeight:600}}>{b.customer}</td>
            <td className="font-mono" style={{fontWeight:700}}>{fmtCur(b.total)}</td>
            <td><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"Paid":"Unpaid"}</span></td>
            <td style={{fontSize:".72rem",color:"var(--text3)"}}>{fmtDate(b.createdAt)}</td>
            <td><button className={`btn btn-sm ${b.paid?"btn-ghost":"btn-success"}`} onClick={async()=>{const np=!b.paid;setBills(bs=>bs.map(x=>x.id===b.id?{...x,paid:np}:x));await db.updateBillPaid(b.id,np);showToast(b.paid?"Marked unpaid":"Payment received!")}}>{b.paid?"Mark Unpaid":"Mark Paid"}</button></td>
          </tr>
        ))}</tbody>
      </table></div></div>
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────
function CustomersPage({ customers, bills }) {
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState("");

  // Use customers from DB when available; otherwise derive from bills so
  // existing billing history still shows up even if customers table is empty.
  const baseCustomers = (customers && customers.length > 0)
    ? customers
    : Object.values(
        bills.reduce((acc, b) => {
          const key = b.phone || b.customer;
          if (!key) return acc;
          if (!acc[key]) {
            acc[key] = {
              id: key,
              name: b.customer || "Customer",
              phone: b.phone || "",
              email: b.email || "",
            };
          }
          return acc;
        }, {})
      );

  const filtered = baseCustomers.filter(
    c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || "").includes(search)
  );
  return (
    <div>
      <div className="flex justify-between mb-4">
        <div className="search-bar" style={{width:280}}><Icon name="search" size={14} color="var(--text3)"/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <span style={{fontSize:".82rem",color:"var(--text3)",alignSelf:"center"}}>{baseCustomers.length} customers</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:sel?"1fr 1fr":"1fr",gap:16}}>
        <div className="card"><div className="table-wrap"><table>
          <thead><tr><th>Customer</th><th>Phone</th><th>Bills</th><th>Spent</th></tr></thead>
          <tbody>{filtered.map(c=>{
            const cb=bills.filter(b=>b.phone===c.phone||b.customer===c.name);
            return <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>setSel(c)}><td><div style={{fontWeight:600}}>{c.name}</div></td><td style={{fontFamily:"var(--mono)",fontSize:".78rem"}}>{c.phone}</td><td>{cb.length}</td><td className="font-mono" style={{fontWeight:700}}>{fmtCur(cb.reduce((s,b)=>s+b.total,0))}</td></tr>;
          })}</tbody>
        </table></div></div>
        {sel&&<div className="card">
          <div className="flex justify-between mb-3"><div className="card-title" style={{marginBottom:0}}>{sel.name}</div><button className="btn btn-sm btn-ghost" onClick={()=>setSel(null)}><Icon name="x" size={12}/></button></div>
          <div style={{fontSize:".8rem",color:"var(--text2)",marginBottom:12}}>{sel.phone}{sel.email?` · ${sel.email}`:""}</div>
          <div style={{fontWeight:600,fontSize:".78rem",marginBottom:8}}>Bill History</div>
          {bills.filter(b=>b.customer===sel.name||b.phone===sel.phone).map(b=>(
            <div key={b.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:".8rem"}}>
              <div><span className="font-mono" style={{color:"var(--accent)",fontWeight:700}}>{b.id}</span><div style={{fontSize:".68rem",color:"var(--text3)"}}>{b.desc} · {fmtDate(b.createdAt)}</div></div>
              <div style={{textAlign:"right"}}><div className="font-mono" style={{fontWeight:700}}>{fmtCur(b.total)}</div><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"Paid":"Unpaid"}</span></div>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

// ── Reports ───────────────────────────────────────────────────────────────────
function ReportsPage({ bills }) {
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const md=months.map((m,i)=>{const b=bills.filter(b=>new Date(b.createdAt).getMonth()===i);return{month:m,total:b.reduce((s,x)=>s+x.total,0),count:b.length};});
  const mx=Math.max(...md.map(d=>d.total),1);
  const tr=bills.filter(b=>b.paid).reduce((s,b)=>s+b.total,0);
  const avg=bills.length?bills.reduce((s,b)=>s+b.total,0)/bills.length:0;
  return (
    <div>
      <div className="stats-grid mb-4">
        {[{label:"Total Revenue",value:fmtCur(tr),c1:"#10b981",c2:"#059669"},{label:"Total Bills",value:bills.length,c1:"#4f67ff",c2:"#7c3aed"},{label:"Avg. Bill",value:fmtCur(avg),c1:"#f59e0b",c2:"#ef4444"},{label:"Collection Rate",value:bills.length?Math.round(bills.filter(b=>b.paid).length/bills.length*100)+"%":"0%",c1:"#8b5cf6",c2:"#6d28d9"}].map((s,i)=>(
          <div key={i} className="stat-card" style={{"--c1":s.c1,"--c2":s.c2}}><div className="stat-value" style={{fontSize:"1.1rem"}}>{s.value}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <div className="card"><div className="card-title">Monthly Revenue 2025</div>
          <div className="bar-chart">{md.map((d,i)=>(
            <div key={i} className="bar-col">
              <div style={{fontSize:".6rem",color:"var(--text3)",marginBottom:4}}>{d.total>0?fmtCur(d.total).replace("₹",""):""}</div>
              <div className="bar" style={{height:`${Math.max((d.total/mx)*80,4)}px`}} title={`${d.month}: ${fmtCur(d.total)}`}/>
              <div className="bar-label">{d.month}</div>
            </div>
          ))}</div>
        </div>
        <div className="card"><div className="card-title">Summary</div>
          {[["Paid Bills",bills.filter(b=>b.paid).length,"badge-green"],["Unpaid Bills",bills.filter(b=>!b.paid).length,"badge-red"],["With GST",bills.filter(b=>b.gst).length,"badge-blue"],["Without GST",bills.filter(b=>!b.gst).length,"badge-purple"]].map(([l,v,c],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<3?"1px solid var(--border)":"none"}}><span style={{fontSize:".82rem",color:"var(--text2)"}}>{l}</span><span className={`badge ${c}`}>{v}</span></div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{marginTop:16,width:"100%",justifyContent:"center"}} onClick={()=>{
            const csv=["Invoice,Customer,Description,Total,Paid,Date",...bills.map(b=>`${b.id||""},${b.customer||""},"${(b.desc||"").replace(/"/g,'""')}",${b.total},${b.paid},${fmtDate(b.createdAt)}`)].join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="report.csv";a.click();
          }}><Icon name="export" size={13}/>Export CSV</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Panel ───────────────────────────────────────────────────────────────
function AdminPanel({ bills, tasks, workers, vendors, vendorBills }) {
  const unpaidVendor = (vendorBills || []).filter(b => !b.paid).reduce((s, b) => s + (b.amount || 0), 0);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div className="card"><div className="card-title">All Bills Overview</div>
          {bills.slice(0,8).map(b=>(
            <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div><div style={{fontWeight:600,fontSize:".82rem"}}>{b.customer}</div><div style={{fontSize:".68rem",color:"var(--text3)",fontFamily:"var(--mono)"}}>{b.id} · {fmtDate(b.createdAt)}</div></div>
              <div style={{textAlign:"right"}}><div className="font-mono" style={{fontWeight:700,fontSize:".85rem"}}>{fmtCur(b.total)}</div><span className={`badge ${b.paid?"badge-green":"badge-red"}`}>{b.paid?"Paid":"Unpaid"}</span></div>
            </div>
          ))}
        </div>
        <div className="card"><div className="card-title">Workers & Task Progress</div>
          {workers.map(w=>{const wt=tasks.filter(t=>t.worker===w.id);const done=wt.filter(t=>t.status==="Completed").length;return(
            <div key={w.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontWeight:600,fontSize:".85rem"}}>{w.name}</span><span style={{fontSize:".72rem",color:"var(--text3)"}}>{done}/{wt.length} tasks</span></div>
              <div style={{background:"var(--surface2)",borderRadius:99,height:6,overflow:"hidden"}}><div style={{background:"linear-gradient(90deg,var(--accent),var(--accent2))",height:"100%",width:wt.length?`${(done/wt.length)*100}%`:"0%",borderRadius:99,transition:"width .4s ease"}}/></div>
            </div>
          );})}
        </div>
      </div>
      {((vendors||[]).length > 0 || (vendorBills||[]).length > 0) && (
        <div className="card" style={{marginTop:16}}>
          <div className="card-title">Vendors & Outstanding</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
            <span>Unpaid vendor bills: <strong className="font-mono" style={{color:"var(--danger)"}}>{fmtCur(unpaidVendor)}</strong></span>
            <span style={{fontSize:".82rem",color:"var(--text2)"}}>{(vendors||[]).length} vendors · {(vendorBills||[]).filter(b=>!b.paid).length} unpaid</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Worker Dashboard ──────────────────────────────────────────────────────────
function WorkerDashboard({ tasks, user }) {
  const mt=tasks.filter(t=>t.worker===user.id);
  return (
    <div>
      <div style={{marginBottom:20,fontSize:"1rem",fontWeight:700}}>Welcome back, {user.name}! 👋</div>
      <div className="stats-grid">
        {[{label:"My Tasks",value:mt.length,c1:"#4f67ff",c2:"#7c3aed"},{label:"Pending",value:mt.filter(t=>t.status==="Pending").length,c1:"#f59e0b",c2:"#ef4444"},{label:"In Progress",value:mt.filter(t=>t.status==="In Progress").length,c1:"#06b6d4",c2:"#0891b2"},{label:"Completed",value:mt.filter(t=>t.status==="Completed").length,c1:"#10b981",c2:"#059669"}].map((s,i)=>(
          <div key={i} className="stat-card" style={{"--c1":s.c1,"--c2":s.c2}}><div className="stat-value">{s.value}</div><div className="stat-label">{s.label}</div></div>
        ))}
      </div>
    </div>
  );
}

// ── Worker Tasks ──────────────────────────────────────────────────────────────
function WorkerTasks({ tasks, setTasks, user, showToast, addNotification }) {
  const mt=tasks.filter(t=>t.worker===user.id);
  const upd=async(id,status)=>{
    setTasks(t=>t.map(x=>x.id===id?{...x,status}:x));
    await db.updateTaskStatus(id, status);
    if(status==="Completed")addNotification("Task completed by "+user.name+": "+tasks.find(t=>t.id===id)?.title);
    showToast(status==="Completed"?"🎉 Task completed! Admin notified.":"Status updated");
  };
  const sc=s=>s==="Completed"?"badge-green":s==="In Progress"?"badge-blue":"badge-yellow";
  return (
    <div><div className="card"><div className="card-title">My Assigned Tasks</div>
      {mt.length===0&&<div style={{textAlign:"center",color:"var(--text3)",padding:40}}>No tasks assigned to you yet</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {mt.map(t=>(
          <div key={t.id} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"14px 16px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontWeight:700}}>{t.title}</div><div style={{fontSize:".72rem",color:"var(--text3)",marginTop:2}}>{t.customer||"No customer"} · Deadline: {t.deadline||"Not set"}</div></div>
              <span className={`badge ${sc(t.status)}`}>{t.status}</span>
            </div>
            {t.notes&&<div style={{fontSize:".78rem",color:"var(--text2)",marginBottom:10}}>{t.notes}</div>}
            <div className="flex gap-2">
              {t.status==="Pending"&&<button className="btn btn-sm btn-primary" onClick={()=>upd(t.id,"In Progress")}>Start Working</button>}
              {t.status==="In Progress"&&<button className="btn btn-sm btn-success" onClick={()=>upd(t.id,"Completed")}>Mark Completed ✓</button>}
              {t.status==="Completed"&&<span style={{fontSize:".78rem",color:"var(--success)",fontWeight:600}}>✓ Admin notified</span>}
            </div>
          </div>
        ))}
      </div>
    </div></div>
  );
}
