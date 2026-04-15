// @refresh reset
import { useState, useEffect, useRef, useMemo } from "react";
import { db, supabase } from "./supabase.js";
import { loadAndResizeImage } from "./ocr/imageTools.js";
import { parsePurchaseFromRaw } from "./ocr/textPurchaseParser.js";
import { runPurchaseOcr } from "./ocr/imageOcr.js";
import EnhancedProductsPage from "./EnhancedProductsPage.jsx";
import EnhancedCustomersPage from "./EnhancedCustomersPage.jsx";
import SimpleBillingPage from "./SimpleBillingPage.jsx";
import ShopDashboard from "./ShopDashboard.jsx";
import AiAgentPage from "./AiAgentPage.jsx";
import LandingPage from "./LandingPage.jsx";
import { getBillPaymentInfo } from "./billingUtils.js";
import AdvancedInvoiceBuilder from "./AdvancedInvoiceBuilder.jsx";
import PaymentInBuilder from "./PaymentInBuilder.jsx";
import LiveAlertsPage from "./LiveAlertsPage.jsx";
import StaffPage from "./StaffPage.jsx";
import VoiceAssistant from "./VoiceAssistant.jsx";
// Task 5.1 – Thin context layer
import { AppProvider } from "./contexts/AppContext.jsx";
// Task 5.4 – Per-page error isolation
import ErrorBoundary from "./components/ErrorBoundary.jsx";


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
  state: "Rajasthan",
  gstNumber: "",
  panNumber: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  branchName: "",
  authorisedSignatory: "Authorised Signatory",
  logo: null,
  // No default QR or UPI – each organisation uploads their own
  paymentQr: null,
  paymentQrLocked: false,
  upiId: null,
  invoicePrefix: "NPW",
  invoiceCounter: 4,
  // Invoice print layout selection (billing flow remains same)
  invoicePrintType: "default", // "default" | "thermal"
  thermalPaperMm: 80, // 58 | 80
  defaultBillingMethod: "modern", // "modern" | "classic"
  // Appearance customization
  bgImage: null,       // base64 wallpaper image
  bgColor: "",         // hex color for main background (overrides CSS var when set)
  sidebarColor: "",    // hex color for sidebar background
  bgBlur: false,       // apply frosted glass blur over wallpaper
};

const now = () => new Date().toISOString();
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const fmtCur = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const genInvId = (brand) => `${brand.invoicePrefix || "NPW"}-${String(brand.invoiceCounter || 1).padStart(4, "0")}`;
const qrImgUrl = (data, size = 100) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
// UPI intent for fixed-amount QR (non-editable, opens payment app with amount)
const upiIntentUrl = (amount, upiId, payeeName, note = "", reference = "") => {
  const params = new URLSearchParams({
    pa: (upiId || "").trim(),
    pn: payeeName || "Merchant",
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
  });
  if (note) params.set("tn", note);
  if (reference) params.set("tr", reference);
  return `upi://pay?${params.toString()}`;
};
const readFile64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

const fmtBillDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
};

const buildInvoiceWhatsAppMessage = ({ bill, brand, billPayments = [] }) => {
  const invLink = `https://www.shiromani.xyz?inv=${bill.id}`;
  const payLink = `https://www.shiromani.xyz?pay=${bill.id}`;
  const info = getBillPaymentInfo(bill, billPayments);
  return [
    `*Invoice from ${brand.shopName}*`,
    ``,
    `Hi ${bill.customer || "Customer"},`,
    ``,
    `Your invoice is ready.`,
    ``,
    `*Invoice No:* ${bill.id}`,
    `*Date & Time:* ${fmtBillDateTime(bill.createdAt) || fmtDate(bill.createdAt)}`,
    `*Work:* ${bill.desc}${bill.size ? " (" + bill.size + ")" : ""}`,
    `*Qty:* ${bill.qty}  |  *Rate:* ${fmtCur(bill.rate)}`,
    bill.gst ? `*GST (18%):* ${fmtCur(bill.gstAmt)}` : null,
    `*Total:* ${fmtCur(bill.total)}`,
    info.paidAmount > 0 ? `*Advance Received:* ${fmtCur(info.paidAmount)}` : null,
    info.paidAmount > 0 ? `*Balance Due:* ${fmtCur(info.remaining)}` : null,
    ``,
    info.isPaid ? "✅ *Status:* PAID" : info.paidAmount > 0 ? "⏳ *Status:* PARTIALLY PAID" : "⏳ *Status:* PAYMENT PENDING",
    ``,
    `📄 *View Invoice:* ${invLink}`,
    !info.isPaid ? `💳 *Pay Now:* ${payLink}` : null,
    ``,
    `Thank you,`,
    `${brand.shopName}`,
    brand.phone ? `Phone: ${brand.phone}` : null,
  ].filter(l => l !== null).join("\n");
};

const openInvoiceWhatsApp = ({ bill, brand, billPayments = [] }) => {
  const msg = buildInvoiceWhatsAppMessage({ bill, brand, billPayments });
  const raw = (bill.phone || brand.whatsapp || "").replace(/\D/g, "");
  if (!raw) return false;
  const target = raw.startsWith("91") || raw.length >= 12 ? raw : `91${raw}`;
  window.open(`https://wa.me/${target}?text=${encodeURIComponent(msg)}`, "_blank");
  return true;
};

const getInvoiceWhatsAppUrl = ({ bill, brand, billPayments = [] }) => {
  const msg = buildInvoiceWhatsAppMessage({ bill, brand, billPayments });
  const raw = (bill.phone || brand.whatsapp || "").replace(/\D/g, "");
  if (!raw) return null;
  const target = raw.startsWith("91") || raw.length >= 12 ? raw : `91${raw}`;
  return `https://wa.me/${target}?text=${encodeURIComponent(msg)}`;
};

// Task 4.3 – Shared AudioContext (one per page) so we don't leak a new
// AudioContext object on every sound playback.
let _sharedAudioCtx = null;
function getAudioCtx() {
  if (!_sharedAudioCtx || _sharedAudioCtx.state === "closed") {
    _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (_sharedAudioCtx.state === "suspended") _sharedAudioCtx.resume();
  return _sharedAudioCtx;
}

export const playAlertSound = () => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch(e) {}
};

export const playSuccessSound = () => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      // Arpeggio C E G C
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch(e) {}
};

const PAYMENT_METHODS = ["cash", "upi", "bank", "card", "other"];

const toWordsUnder1000 = (n) => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`.trim();
  return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${toWordsUnder1000(n % 100)}` : ""}`.trim();
};
const amountToWords = (amount) => {
  const num = Math.round(Number(amount) || 0);
  if (!num) return "Zero Rupees";
  const parts = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [1, ""],
  ];
  let rem = num;
  const out = [];
  for (const [div, label] of parts) {
    const chunk = Math.floor(rem / div);
    if (!chunk) continue;
    rem %= div;
    out.push(`${toWordsUnder1000(chunk)}${label ? ` ${label}` : ""}`.trim());
  }
  return `${out.join(" ")} Rupees`;
};

const getVendorBillPaymentInfo = (vb, vendorPayments) => {
  const vid = vb.id ?? vb.bill_number;
  const payments = (vendorPayments || []).filter(p => (p.vendorBillId || p.vendor_bill_id) === vid);
  const paidAmount = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const total = Number(vb.amount) || 0;
  const remaining = Math.max(0, total - paidAmount);
  const status = paidAmount <= 0 ? "Unpaid" : paidAmount >= total ? "Paid" : "Partially Paid";
  const isPaid = paidAmount >= total;
  return { paidAmount, remaining, status, isPaid };
};

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#f4f6fa;--surface:#fff;--surface2:#f0f2f7;--border:#dfe3eb;--accent:#2563eb;--accent2:#4f46e5;--accent-soft:#eff6ff;--success:#0d9488;--warning:#d97706;--danger:#dc2626;--text:#0f172a;--text2:#475569;--text3:#64748b;--shadow:0 1px 2px rgba(0,0,0,.04),0 4px 12px rgba(0,0,0,.06);--shadow-md:0 4px 12px -2px rgba(0,0,0,.06),0 2px 6px -2px rgba(0,0,0,.04);--shadow-lg:0 16px 40px -12px rgba(0,0,0,.12),0 4px 16px -4px rgba(0,0,0,.06);--radius:14px;--radius-sm:10px;--sw:240px;--font:'Plus Jakarta Sans',system-ui,sans-serif;--mono:'JetBrains Mono',monospace;--t:.28s cubic-bezier(.25,.46,.45,.94);--t-fast:.2s cubic-bezier(.25,.46,.45,.94)}
.dark{--bg:#0c1222;--surface:#151b2d;--surface2:#1e2738;--border:#2d3748;--text:#f1f5f9;--text2:#94a3b8;--text3:#64748b;--accent-soft:#1e3a5f;--shadow:0 1px 2px rgba(0,0,0,.2);--shadow-lg:0 16px 40px -12px rgba(0,0,0,.4)}
body{font-family:var(--font);background:var(--bg);color:var(--text);transition:background var(--t),color var(--t);min-height:100vh;-webkit-font-smoothing:antialiased}
*[role="button"],button,.btn,.nav-item,.user-chip,.toggle-wrap,.upload-box,.cursor-pointer{cursor:pointer}
::-webkit-scrollbar{width:6px;height:6px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}
::-webkit-scrollbar-thumb:hover{background:var(--text3)}
.app-layout{display:flex;min-height:100vh}
.main-content{flex:1;margin-left:var(--sw);min-height:100vh;transition:margin var(--t)}
@media(max-width:768px){.main-content{margin-left:0}}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:var(--sw);background:#0B132B;border-right:1px solid #1c274c;display:flex;flex-direction:column;z-index:100;transition:transform var(--t),background var(--t);overflow-y:auto;box-shadow:2px 0 12px rgba(0,0,0,.04)}
.dark .sidebar{box-shadow:2px 0 16px rgba(0,0,0,.2)}
.sidebar.open{transform:translateX(0)}
.s-logo{padding:16px 14px;border-bottom:1px solid #1c274c;display:flex;align-items:center;gap:10px}
.s-logo img{width:36px;height:36px;border-radius:8px;object-fit:contain;background:#1e293b}
.s-logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.s-brand{font-weight:800;font-size:1rem;color:#ffffff;letter-spacing:-.02em}
.s-sub{font-size:.65rem;color:#94a3b8;font-weight:500;margin-top:1px}
.s-nav{padding:12px 10px;flex:1}
.s-sec{font-size:.65rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.1em;padding:10px 10px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius-sm);cursor:pointer;font-size:.875rem;font-weight:500;color:#94a3b8;margin:2px 4px;transition:transform var(--t-fast),background var(--t),color var(--t)}
.nav-item:hover{background:#1c274c;color:#ffffff;transform:translateX(6px) scale(1.03)}
.nav-item:active{transform:translateX(3px) scale(0.99)}
.nav-item.active{background:#2563eb;color:#ffffff;font-weight:600;box-shadow:0 4px 12px rgba(37,99,235,.3)}
.nav-item .nbadge{margin-left:auto;background:var(--danger);color:#fff;font-size:.6rem;font-weight:700;padding:1px 6px;border-radius:99px;font-family:var(--mono)}
.s-footer{padding:14px 12px;border-top:1px solid #1c274c}
.user-chip{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);background:#1c274c;cursor:pointer;transition:transform var(--t-fast),background var(--t)}
.user-chip:hover{background:#2d3748;transform:translateY(-1px)}
.user-chip:active{transform:translateY(0) scale(0.98)}
.u-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;color:#fff;flex-shrink:0}
.u-name{font-size:.82rem;font-weight:600;color:#f1f5f9}
.u-role{font-size:.68rem;color:#94a3b8}
.topbar{position:sticky;top:0;z-index:50;background:var(--surface);border-bottom:1px solid var(--border);padding:14px 24px;display:flex;align-items:center;gap:12px;transition:background var(--t);color:var(--text);box-shadow:var(--shadow)}
.topbar-title{font-size:1.05rem;font-weight:700;flex:1;color:var(--text);letter-spacing:-.02em}
.topbar-logo{height:32px;width:auto;max-width:100px;object-fit:contain}
.page{padding:24px;max-width:100%}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px;box-shadow:var(--shadow);transition:transform var(--t-fast),box-shadow var(--t),border-color var(--t);position:relative}
.card:hover{box-shadow:var(--shadow-lg);border-color:var(--border);transform:translateY(-2px)}
.card-title{font-size:.95rem;font-weight:700;margin-bottom:16px;color:var(--text);letter-spacing:-.02em}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:20px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px 20px;box-shadow:var(--shadow);transition:transform var(--t),box-shadow var(--t),border-color var(--t);position:relative;overflow:hidden;cursor:default}
.stat-card:hover{transform:translateY(-6px);box-shadow:var(--shadow-lg);border-color:var(--border)}
.stat-card:active{transform:translateY(-3px)}
.stat-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--c1),var(--c2));border-radius:var(--radius) var(--radius) 0 0}
.stat-value{font-size:1.5rem;font-weight:800;font-family:var(--mono);color:var(--text);line-height:1}
.stat-label{font-size:.72rem;color:var(--text2);margin-top:4px;font-weight:500}
.stat-sub{font-size:.68rem;color:var(--text3);margin-top:2px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:var(--radius-sm);font-family:var(--font);font-size:.82rem;font-weight:600;border:none;cursor:pointer;transition:transform var(--t),box-shadow var(--t),background var(--t);white-space:nowrap}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn:hover{transform:translateY(-3px) scale(1.02)}
.btn:active{animation:btnPop .25s ease}
@keyframes btnPop{0%{transform:translateY(-3px) scale(1.02)}40%{transform:translateY(1px) scale(0.97)}100%{transform:translateY(0) scale(1)}}
.btn-primary{background:var(--accent);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.22)}
.btn-primary:hover{background:#1d4ed8;box-shadow:0 8px 24px rgba(37,99,235,.35)}
.btn-success{background:var(--success);color:#fff}
.btn-success:hover{background:#059669}
.btn-danger{background:var(--danger);color:#fff}
.btn-danger:hover{background:#dc2626}
.btn-warning{background:var(--warning);color:#fff}
.btn-warning:hover{background:#d97706}
.btn-ghost{background:var(--surface2);color:var(--text2);border:1px solid var(--border)}
.btn-ghost:hover{background:var(--border);color:var(--text);transform:translateY(-2px) scale(1.01)}
.btn-sm{padding:6px 12px;font-size:.75rem}
.btn-icon{padding:8px;border-radius:var(--radius-sm);transition:transform var(--t)}
.btn-icon:hover{transform:scale(1.1) translateY(-2px)}
.btn-icon:active{animation:iconPop .22s ease}
@keyframes iconPop{0%{transform:scale(1.1) translateY(-2px)}50%{transform:scale(0.92)}100%{transform:scale(1)}}
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
input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.1)}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:none}
input[readonly]{opacity:.7;cursor:not-allowed}
textarea{resize:vertical;min-height:80px}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:.82rem}
th{background:var(--surface2);font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);padding:10px 14px;text-align:left}
td{padding:12px 14px;border-bottom:1px solid var(--border);color:var(--text);vertical-align:middle;transition:background var(--t-fast)}
.bill-items-table td{padding:10px 8px}
.bill-items-table input{width:100%;min-width:0}
.bill-items-table td:first-child{min-width:160px}
.bill-items-table td:last-child,.bill-items-table th:last-child{width:44px}
tr:last-child td{border-bottom:none}
tbody tr{cursor:default;transition:background var(--t-fast),transform var(--t-fast)}
tbody tr:hover td{background:var(--surface2)}
tbody tr:active td{background:var(--border)}
.table-wrap{-webkit-overflow-scrolling:touch}
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
.toggle:active::after{transform:translateX(14px)}
.toggle.on:active::after{transform:translateX(20px)}
.toggle-label{font-size:.82rem;font-weight:500;color:var(--text2)}
.modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;animation:modalFadeIn .25s ease}
.modal{background:var(--surface);border-radius:var(--radius);padding:28px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px -12px rgba(0,0,0,.25),0 0 0 1px rgba(0,0,0,.06);animation:modalPopIn .3s cubic-bezier(.34,1.56,.64,1);border:1px solid var(--border)}
.modal-title{font-size:1.15rem;font-weight:800;margin-bottom:20px;color:var(--text);letter-spacing:-.02em}
.modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;padding-top:18px;border-top:1px solid var(--border);flex-wrap:wrap}
@keyframes modalFadeIn{from{opacity:0}to{opacity:1}}
@keyframes modalPopIn{from{opacity:0;transform:translateY(20px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.search-bar{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:8px 14px;transition:border-color var(--t),box-shadow var(--t)}
.search-bar:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.08)}
.search-bar input{background:transparent;border:none;padding:0;font-size:.85rem;flex:1}
.search-bar input:focus{box-shadow:none}
.search-bar input::placeholder{color:var(--text3)}
.alert{position:fixed;top:20px;right:20px;z-index:300;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);padding:14px 20px;box-shadow:var(--shadow-lg);font-size:.875rem;font-weight:500;display:flex;align-items:center;gap:10px;animation:toastPopIn .35s cubic-bezier(.34,1.56,.64,1);max-width:360px}
@keyframes toastPopIn{from{opacity:0;transform:translateX(24px) scale(0.9)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes slideLeft{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#0f172a 0%,#1e293b 35%,#312e81 70%,#1e3a8a 100%);background-size:400% 400%;animation:loginGradient 12s ease infinite;padding:20px;position:relative;overflow:hidden;overflow-x:hidden}
@media(max-width:768px){.login-page{align-items:flex-start;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:20px 16px 40px}}
.dark .login-page{animation:loginGradient 12s ease infinite}
@keyframes loginGradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
.login-bg-orb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.25;pointer-events:none}
.login-bg-orb-1{width:320px;height:320px;background:linear-gradient(135deg,#6366f1,#8b5cf6);top:-80px;right:-80px;animation:loginOrb1 8s ease-in-out infinite}
.login-bg-orb-2{width:240px;height:240px;background:linear-gradient(135deg,#3b82f6,#06b6d4);bottom:10%;left:-60px;animation:loginOrb2 10s ease-in-out infinite}
.login-bg-orb-3{width:180px;height:180px;background:linear-gradient(135deg,#f59e0b,#ec4899);top:50%;left:30%;animation:loginOrb3 9s ease-in-out infinite}
@keyframes loginOrb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-20px,20px) scale(1.05)}}
@keyframes loginOrb2{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-15px)}}
@keyframes loginOrb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10px,25px) scale(1.1)}}
.login-side-accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(180deg,transparent,#6366f1,#8b5cf6,#06b6d4,transparent);background-size:100% 200%;animation:loginSideShine 4s ease-in-out infinite;opacity:.9}
@keyframes loginSideShine{0%,100%{opacity:.6}50%{opacity:1}}
.login-card{width:100%;max-width:380px;box-shadow:0 24px 60px rgba(0,0,0,.35),0 0 0 1px rgba(255,255,255,.08);border-radius:20px;overflow:visible;position:relative;z-index:2;background:rgba(255,255,255,.97);backdrop-filter:blur(12px)}
.dark .login-card{background:rgba(30,41,59,.95)}
.login-shell{width:min(1100px,100%);max-width:100%;display:grid;grid-template-columns:minmax(0,380px) minmax(0,1fr);gap:22px;align-items:stretch}
.login-hero{display:none}
@media(min-width:980px){
  .login-page{justify-content:center}
  .login-shell{grid-template-columns:380px 1fr}
  .login-hero{display:flex;flex-direction:column;gap:14px;border-radius:22px;border:1px solid rgba(255,255,255,.10);background:rgba(2,6,23,.35);box-shadow:0 24px 70px rgba(0,0,0,.35);padding:18px;position:relative;overflow:hidden}
  .login-hero::before{content:"";position:absolute;inset:-1px;background:radial-gradient(900px 420px at 15% 10%,rgba(79,103,255,.22),transparent 60%),radial-gradient(700px 360px at 85% 20%,rgba(124,58,237,.20),transparent 55%);pointer-events:none}
  .login-hero-top{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px}
  .login-hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.35);color:rgba(226,232,240,.92);font-weight:900;font-size:12px}
  .login-hero-shot{position:relative;border-radius:18px;border:1px solid rgba(148,163,184,.16);background:rgba(15,23,42,.28);overflow:hidden}
  .login-hero-shot img{width:100%;height:auto;display:block;transform:translateY(0);filter:saturate(1.05) contrast(1.02)}
  .login-hero-points{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .login-hero-point{border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(15,23,42,.26);padding:12px}
  .login-hero-point b{display:block;color:#fff;font-weight:900;margin-bottom:4px}
  .login-hero-point span{display:block;color:rgba(226,232,240,.78);font-size:12px;line-height:1.55}
}
.login-cursor-ring{position:fixed;width:48px;height:48px;border:2px solid rgba(255,255,255,.7);border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);transition:left .12s ease-out,top .12s ease-out;z-index:10;opacity:.6;box-shadow:0 0 20px rgba(99,102,241,.4)}
.login-btn-wrap{transition:transform .2s cubic-bezier(.25,.46,.45,.94);will-change:transform}
.login-btn-magnetic:hover{transform:translateY(-2px)}
.segmented{display:flex;gap:6px;background:var(--surface2);border:1.5px solid var(--border);border-radius:12px;padding:6px}
.segmented-btn{flex:1;border:none;background:transparent;padding:9px 10px;border-radius:10px;font-weight:800;font-size:.8rem;color:var(--text2);cursor:pointer;transition:background var(--t-fast),color var(--t-fast),transform var(--t-fast)}
.segmented-btn:hover{background:rgba(99,102,241,.12)}
.segmented-btn.active{background:linear-gradient(135deg,#4f67ff,#7c3aed);color:#fff;box-shadow:0 10px 22px rgba(79,103,255,.22)}
.segmented-btn:active{transform:scale(.99)}
.login-header-wrap{text-align:center;margin-bottom:28px;transition:transform .22s cubic-bezier(.25,.46,.45,.94);will-change:transform}
.login-welcome{font-size:.75rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#6366f1;margin:0 0 10px;transform:translateY(-8px);opacity:0;animation:loginWelcomeIn .8s ease .2s forwards}
@keyframes loginWelcomeIn{to{opacity:1;transform:translateY(0)}}
.login-logo-img{width:72px;height:72px;object-fit:contain;border-radius:16px;margin:0 auto 12px;display:block;animation:loginLogoIn .6s ease .1s both}
.login-logo-placeholder{width:56px;height:56px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;animation:loginLogoIn .6s ease .1s both}
@keyframes loginLogoIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
.login-shop-name{font-weight:800;font-size:1.5rem;background:linear-gradient(135deg,#312e81,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0 0 4px;letter-spacing:-.02em;animation:loginTitleIn .7s ease .3s both}
@keyframes loginTitleIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.login-subtitle{font-size:.8rem;color:var(--text3);margin:0;animation:loginSubIn .6s ease .45s both}
@keyframes loginSubIn{from{opacity:0}to{opacity:1}}
.login-credit{position:fixed;z-index:5;pointer-events:none;text-align:right;transition:opacity .25s ease,visibility .25s ease}
.login-credit-follow{transform:translate(-100px,-95px);transition:left .18s cubic-bezier(.25,.46,.45,.94),top .18s cubic-bezier(.25,.46,.45,.94),opacity .25s ease,transform .2s cubic-bezier(.34,1.2,.64,1)}
.login-credit-follow:hover{transform:translate(-100px,-95px) scale(1.05)}
.login-credit-inner{background:rgba(15,23,42,.78);backdrop-filter:blur(10px);padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);box-shadow:0 8px 32px rgba(0,0,0,.3);display:inline-block;text-align:right;animation:loginCreditPulse 2.2s ease-in-out infinite}
@keyframes loginCreditPulse{0%,100%{transform:scale(1);box-shadow:0 8px 32px rgba(0,0,0,.3)}50%{transform:scale(1.04);box-shadow:0 12px 40px rgba(0,0,0,.35),0 0 24px rgba(99,102,241,.2)}}
.login-credit-label{display:block;font-size:.65rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.7)}
.login-credit-name{display:block;font-size:.9rem;font-weight:800;color:#fff;text-shadow:0 0 24px rgba(255,255,255,.5),0 0 48px rgba(99,102,241,.35);letter-spacing:.04em;animation:loginCreditGlow 2.5s ease-in-out infinite}
@keyframes loginCreditGlow{0%,100%{text-shadow:0 0 24px rgba(255,255,255,.45),0 0 48px rgba(99,102,241,.3)}50%{text-shadow:0 0 32px rgba(255,255,255,.6),0 0 64px rgba(99,102,241,.45)}}
@keyframes loginCreditPop{0%{opacity:0;transform:translate(-100px,-95px) translateY(12px) scale(0.9)}70%{opacity:1;transform:translate(-100px,-95px) translateY(-2px) scale(1.02)}100%{opacity:1;transform:translate(-100px,-95px) translateY(0) scale(1)}}
.quick-actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px}
.bar-chart{display:flex;align-items:flex-end;gap:6px;height:100px}
.bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.bar{width:100%;background:linear-gradient(to top,var(--accent),var(--accent2));border-radius:4px 4px 0 0;transition:height .4s ease;min-height:4px}
.bar-label{font-size:.62rem;color:var(--text3);font-family:var(--mono)}
.mob-btn{display:none}
@media(max-width:768px){.mob-btn{display:flex}.sidebar{transform:translateX(-100%)}.s-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99}}
.safe-area{padding-bottom:env(safe-area-inset-bottom)}
@media(max-width:768px){
  :root{--sw:240px}
  .login-shell{width:100%;max-width:420px;grid-template-columns:1fr;gap:0}
  .login-card{max-width:none;width:100%;border-radius:18px}
  .login-header-wrap{margin-bottom:20px}
  .login-welcome{font-size:.68rem}
  .login-shop-name{font-size:1.2rem}
  .login-subtitle{font-size:.78rem;line-height:1.5}
  .login-logo-img,.login-logo-placeholder{width:60px;height:60px}
  .login-side-accent,.login-bg-orb-3,.login-cursor-ring,.login-credit{display:none!important}
  .segmented{padding:5px;gap:4px}
  .segmented-btn{padding:10px 8px;font-size:.76rem}
  .topbar{padding:12px 14px;gap:10px}
  .topbar-title{font-size:.95rem}
  .page{padding:14px}
  .card{padding:16px}
  .card-title{font-size:.9rem}
  .stats-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .stat-card{padding:14px}
  .stat-value{font-size:1.15rem}
  .quick-actions{gap:8px}
  .btn{padding:9px 14px}
  .btn-sm{padding:6px 10px}
  .search-bar{width:100%!important}
  .modal-overlay{padding:12px}
  .modal{padding:18px;max-height:92vh}
  th{padding:8px 10px;font-size:.62rem}
  td{padding:10px 10px}
}
@media(max-width:420px){
  .login-page{padding:12px 12px 24px}
  .login-shell{max-width:none}
  .login-card{border-radius:16px}
  .login-shop-name{font-size:1.08rem}
  .login-subtitle{font-size:.74rem}
  .stats-grid{grid-template-columns:1fr}
  .topbar-logo{max-width:84px}
}
.flex{display:flex}.flex-1{flex:1}.items-center{align-items:center}.justify-between{justify-content:space-between}.gap-2{gap:8px}.gap-3{gap:12px}.mb-4{margin-bottom:16px}.mb-3{margin-bottom:12px}.text-sm{font-size:.82rem}.font-mono{font-family:var(--mono)}.divider{height:1px;background:var(--border);margin:16px 0}
/* Settings */
.set-sec-title{font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--accent-soft)}
.upload-box{border:2px dashed var(--border);border-radius:var(--radius-sm);padding:20px;text-align:center;cursor:pointer;transition:transform var(--t-fast),border-color var(--t),background var(--t);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}
.upload-box:hover{border-color:var(--accent);background:var(--accent-soft);transform:scale(1.01)}
.upload-box:active{transform:scale(0.99)}
.lock-badge{display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-size:.68rem;font-weight:700;margin-top:6px}
.dark .lock-badge{background:#451a03;color:#fcd34d}
/* Invoice – explicit dark text on white so no white-on-white overlap */
.inv-wrap{background:#fff;color:#1a1d2e;font-family:'Sora',sans-serif;padding:30px;border-radius:10px}
.inv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #4f67ff}
.inv-logo{width:60px;height:60px;object-fit:contain;border-radius:8px}
.inv-logo-ph{width:60px;height:60px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;display:flex;align-items:center;justify-content:center}
.inv-shop-name{font-size:1.2rem;font-weight:800;color:#2d3a9f;letter-spacing:-.02em}
.inv-shop-details{font-size:.7rem;color:#4b5563;margin-top:3px;line-height:1.7}
.inv-right{text-align:right}
.inv-title{font-size:2rem;font-weight:900;color:#111827;letter-spacing:-.04em;text-transform:uppercase}
.inv-meta{font-size:.7rem;color:#4b5563;margin-top:5px;line-height:1.8}
.inv-bill-row{display:flex;gap:12px;margin-bottom:18px}
.inv-bill-box{background:#f7f8fc;border-radius:8px;padding:11px 14px;flex:1}
.inv-lbl{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:3px}
.inv-val{font-size:.8rem;font-weight:600;color:#1a1d2e}
.inv-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:.78rem}
.inv-table thead tr{background:#2d3a9f;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-table th{color:#fff!important;background:#2d3a9f!important;padding:8px 11px;text-align:left;font-size:.66rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.inv-table td{padding:9px 11px;border-bottom:1px solid #e4e8f0;color:#1a1d2e}
.inv-table tbody tr:nth-child(even) td{background:#f7f8fc}
.inv-totals{display:flex;justify-content:flex-end;margin-bottom:18px}
.inv-totals-box{min-width:210px}
.inv-total-row{display:flex;justify-content:space-between;padding:4px 0;font-size:.8rem;color:#6b7280}
.inv-grand{display:flex;justify-content:space-between;padding:9px 13px;margin-top:7px;background:linear-gradient(135deg,#4f67ff,#7c3aed);border-radius:8px;font-size:.95rem;font-weight:800;color:#fff}
.inv-status{display:inline-flex;align-items:center;gap:5px;padding:5px 13px;border-radius:99px;font-size:.75rem;font-weight:800}
.inv-paid{background:#d1fae5;color:#065f46}
.inv-partial{background:#fef3c7;color:#92400e}
.inv-unpaid{background:#fee2e2;color:#991b1b}
.inv-footer{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid #e4e8f0}
.inv-qr-group{display:flex;gap:14px}
.inv-qr-label{font-size:.6rem;color:#6b7280;text-align:center;margin-top:3px}
@media print{
  @page{size:A4;margin:10mm}
  .no-print{display:none!important}
  /* Prevent print capturing animation start states */
  *,*::before,*::after{animation:none!important;transition:none!important}
  html,body{background:#fff!important;color:#000!important;margin:0;padding:0}
  .modal-overlay{position:static!important;inset:auto!important;background:none!important;padding:0!important}
  .modal{box-shadow:none!important;max-height:none!important;overflow:visible!important;border:none!important;background:transparent!important;max-width:none!important;width:auto!important;padding:0!important}
  .inv-wrap{max-width:190mm;margin:0 auto;border-radius:0}
  .inv-wrap,.inv-header,.inv-shop-name,.inv-title,.inv-meta,.inv-val,.inv-table th,.inv-table td{color:#1a1d2e!important}
  .inv-shop-name,.inv-title{color:#111827!important}
  .inv-table thead tr,.inv-table th{background:#2d3a9f!important;color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}

/* ── Landing page now handled by LandingPage.jsx + Tailwind ── */
.register-shell{width:min(1220px,calc(100vw - 32px));display:grid;grid-template-columns:1.05fr .95fr;gap:44px;align-items:center}
.register-shell-success{width:min(1120px,calc(100vw - 32px));display:grid;grid-template-columns:1fr;justify-items:center}
.register-marketing{color:#0f172a;padding:20px 8px 20px 4px}
.register-card-wrap{display:flex;justify-content:center}
.register-card{width:min(520px,100%);background:rgba(255,255,255,.95);border:1px solid rgba(148,163,184,.16);border-radius:28px;padding:32px;box-shadow:0 24px 80px rgba(15,23,42,.14)}
.register-success-card{width:min(520px,100%);background:rgba(255,255,255,.95);border:1px solid rgba(148,163,184,.18);border-radius:30px;padding:36px;box-shadow:0 24px 80px rgba(15,23,42,.18);text-align:center}
.register-points{display:grid;gap:16px;margin-top:34px;max-width:500px}
.register-quote{margin-top:38px;max-width:560px;border-radius:22px;border:1px solid rgba(108,92,255,.14);background:#fff;box-shadow:0 12px 34px rgba(148,163,184,.12);padding:24px}
.register-brand{display:inline-flex;align-items:center;gap:12px;margin-bottom:30px}
.register-mobile-back{display:none}
.register-stepbar{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.register-step{display:flex;align-items:center;gap:10px;flex:1}
.register-step-end{justify-content:flex-end}
.register-divider{flex:1;height:1px;background:rgba(148,163,184,.28)}
.register-actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}
.register-actions .btn{min-height:46px}
.register-primary-wide{width:100%;margin-top:24px;justify-content:center;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,#a69cf8,#be9af7);color:#fff;box-shadow:none}
.mobile-list{display:grid;gap:12px}
.mobile-bill-card{border:1px solid var(--border);border-radius:18px;background:var(--surface);padding:14px;box-shadow:var(--shadow)}
.mobile-bill-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.mobile-bill-id{font-family:var(--mono);font-size:.76rem;font-weight:800;color:var(--accent)}
.mobile-bill-customer{font-size:.98rem;font-weight:700;color:var(--text);line-height:1.35}
.mobile-bill-phone{font-size:.74rem;color:var(--text3);margin-top:2px}
.mobile-bill-desc{font-size:.84rem;color:var(--text2);line-height:1.55;margin-bottom:10px}
.mobile-bill-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.mobile-bill-meta{padding:10px 12px;border-radius:14px;background:var(--surface2);border:1px solid rgba(148,163,184,.08)}
.mobile-bill-label{font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);margin-bottom:5px}
.mobile-bill-value{font-size:.84rem;font-weight:700;color:var(--text)}
.mobile-bill-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.mobile-bill-actions .btn{width:100%;justify-content:center;min-height:42px}
@media(max-width:768px){
  .register-shell,.register-shell-success{width:min(100vw - 20px, 1220px)}
  .register-shell{grid-template-columns:1fr;gap:22px}
  .register-marketing{padding:4px 2px;order:2}
  .register-card-wrap{order:1}
  .register-card{padding:20px;border-radius:22px}
  .register-success-card{padding:24px;border-radius:24px}
  .register-brand{display:none}
  .register-mobile-back{display:block;margin-top:14px;text-align:center}
  .register-points{display:none}
  .register-quote{margin-top:18px;padding:16px}
  .register-stepbar{margin-bottom:20px}
  .register-actions{flex-direction:column}
  .register-actions .btn{width:100%;justify-content:center}
  .mobile-bill-grid{grid-template-columns:1fr}
  .mobile-bill-actions{grid-template-columns:1fr 1fr}
}
@media(max-width:480px){
  .register-card{padding:16px}
  .register-success-card{padding:20px}
  .register-stepbar{gap:8px}
  .register-quote{display:none}
  .mobile-bill-actions{grid-template-columns:1fr}
}
`;

/* ── LandingPage is now imported from ./LandingPage.jsx ── */


function waitForImagesInDoc(doc, timeoutMs = 2000) {
  try {
    const imgs = Array.from(doc.images || []);
    if (imgs.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => {
        if (done) return;
        done = true;
        resolve();
      }, timeoutMs);
      let left = imgs.length;
      const finish = () => {
        left -= 1;
        if (left <= 0 && !done) {
          done = true;
          clearTimeout(t);
          resolve();
        }
      };
      imgs.forEach((img) => {
        if (img.complete) return finish();
        img.addEventListener("load", finish, { once: true });
        img.addEventListener("error", finish, { once: true });
      });
    });
  } catch {
    return Promise.resolve();
  }
}

function AppLoader({
  title = "Loading PrintMaster Pro...",
  subtitle = "Preparing your workspace.",
  compact = false,
  icon = "printer",
}) {
  const shellStyle = compact
    ? {
        width: "min(440px, calc(100vw - 32px))",
        background: "rgba(255,255,255,.92)",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 24px 70px rgba(15,23,42,.12)",
        backdropFilter: "blur(16px)",
      }
    : {
        width: "min(520px, calc(100vw - 32px))",
        background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96))",
        border: "1px solid rgba(148,163,184,.16)",
        borderRadius: 30,
        padding: "28px 28px 24px",
        boxShadow: "0 30px 100px rgba(15,23,42,.16)",
        backdropFilter: "blur(18px)",
      };

  return (
    <>
      <style>{`
        @keyframes pmLoaderSpin{to{transform:rotate(360deg)}}
        @keyframes pmLoaderPulse{0%,100%{opacity:.45;transform:scaleX(.72)}50%{opacity:1;transform:scaleX(1)}}
        @keyframes pmLoaderShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(220%)}}
      `}</style>
      <div style={shellStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <div style={{ position: "relative", width: compact ? 54 : 62, height: compact ? 54 : 62, flexShrink: 0 }}>
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 18,
                background: "linear-gradient(135deg,#4f67ff,#7c3aed)",
                boxShadow: "0 18px 40px rgba(79,103,255,.30)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={icon} size={compact ? 24 : 28} color="#fff" />
            </div>
            <div
              style={{
                position: "absolute",
                inset: -6,
                borderRadius: 22,
                border: "2px solid rgba(79,103,255,.18)",
                borderTopColor: "#4f67ff",
                animation: "pmLoaderSpin 1.1s linear infinite",
              }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".18em", textTransform: "uppercase", color: "#6366f1", marginBottom: 6 }}>
              PrintMaster Pro
            </div>
            <div style={{ fontSize: compact ? "1rem" : "1.18rem", fontWeight: 800, color: "var(--text)", letterSpacing: "-.02em" }}>{title}</div>
            <div style={{ fontSize: ".82rem", color: "var(--text3)", marginTop: 4, lineHeight: 1.6 }}>{subtitle}</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ height: 8, borderRadius: 999, background: "rgba(148,163,184,.18)", overflow: "hidden", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: "52%",
                borderRadius: 999,
                background: "linear-gradient(90deg,#4f67ff,#7c3aed,#06b6d4)",
                transformOrigin: "left center",
                animation: "pmLoaderPulse 1.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1.1fr .9fr", gap: 12 }}>
          <div style={{ borderRadius: 18, background: "rgba(241,245,249,.95)", border: "1px solid rgba(148,163,184,.14)", padding: 14 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>
              Syncing data
            </div>
            {[72, 88, 58].map((w, idx) => (
              <div key={idx} style={{ height: 10, width: `${w}%`, borderRadius: 999, background: "rgba(203,213,225,.75)", marginBottom: idx === 2 ? 0 : 10, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,.85),transparent)", animation: "pmLoaderShimmer 1.4s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 18, background: "linear-gradient(135deg,rgba(79,103,255,.10),rgba(124,58,237,.10))", border: "1px solid rgba(99,102,241,.14)", padding: 14 }}>
            <div style={{ fontSize: ".7rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "#6366f1", marginBottom: 10 }}>
              Status
            </div>
            <div style={{ fontSize: ".92rem", fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Almost ready</div>
            <div style={{ fontSize: ".78rem", color: "var(--text3)", lineHeight: 1.6 }}>We&apos;re loading your latest bills, payments, and settings.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function printInvoiceElement(el) {
  if (!el) return;
  const printType = (el.getAttribute("data-print-type") || "default").toLowerCase();
  const paperMm = Number(el.getAttribute("data-paper-mm") || 80) || 80;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "print");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument || win?.document;
  if (!win || !doc) {
    document.body.removeChild(iframe);
    return;
  }

  const cleanup = () => {
    try { document.body.removeChild(iframe); } catch {}
  };

  win.onafterprint = cleanup;

  doc.open();
  doc.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice</title>
    <style>${CSS}</style>
    <style>
      ${printType === "thermal"
        ? `@page { size: ${paperMm}mm auto; margin: 0mm; }
           html, body { margin: 0; padding: 0; background: #fff; color: #000; width: ${paperMm}mm; }
           body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
           * { box-sizing: border-box; }`
        : `@page { size: A4; margin: 10mm; }
           html, body { margin: 0; padding: 0; background: #fff; color: #000; }`
      }
      .no-print { display: none !important; }
      .inv-wrap { max-width: 190mm; margin: 0 auto; border-radius: 0; }
    </style>
  </head>
  <body>
    ${el.outerHTML}
    <script>
      window.addEventListener('load', () => {
        setTimeout(() => { window.focus(); window.print(); }, 50);
      });
    </script>
  </body>
</html>`);
  doc.close();

  // Fallback: in case load event doesn't fire as expected
  setTimeout(async () => {
    try {
      await waitForImagesInDoc(doc, 2000);
      win.focus();
      win.print();
    } catch {}
    setTimeout(cleanup, 1500);
  }, 250);
}

async function downloadInvoiceElement(el, filename = "invoice.pdf") {
  if (!el) return;
  const printType = (el.getAttribute("data-print-type") || "default").toLowerCase();
  const paperMm = Number(el.getAttribute("data-paper-mm") || 80) || 80;
  const mod = await import("html2pdf.js");
  const html2pdf = mod.default || mod;
  const clone = el.cloneNode(true);
  if (printType === "thermal") {
    clone.style.maxWidth = `${paperMm}mm`;
    clone.style.width = `${paperMm}mm`;
  } else {
    clone.style.maxWidth = "190mm";
    clone.style.width = "190mm";
  }
  clone.style.margin = "0 auto";
  clone.style.boxShadow = "none";
  clone.querySelectorAll(".no-print").forEach(node => node.remove());

  const wrapper = document.createElement("div");
  wrapper.style.background = "#ffffff";
  wrapper.style.padding = "0";
  wrapper.appendChild(clone);

  const worker = html2pdf()
    .set({
      margin: printType === "thermal" ? [2, 2, 2, 2] : [8, 8, 8, 8],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: printType === "thermal" ? [paperMm, 300] : "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(wrapper);

  const blob = await worker.outputPdf("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

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
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[name]||null}</svg>;
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type = "success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const col = { success: "#10b981", error: "#ef4444", info: "#4f67ff", warning: "#f59e0b" };
  return <div className="alert" style={{ borderLeft: `4px solid ${col[type]}` }}><span>{type==="success"?"✓":"✕"}</span>{msg}</div>;
};

// ── Org Registration (public, ?register) ───────────────────────────────────────
function OrgRegistrationPage({ showToast }) {
  const [form, setForm] = useState({
    name: "", shopName: "", logo: "", address: "", phone: "",
    adminUsername: "", adminPassword: "", adminName: "", adminEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(1);

  const go = (path) => {
    try {
      window.location.href = path;
    } catch {
      window.location.assign(path);
    }
  };

  const handleLogoFile = async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        const dataUrl = await readFile64(f);
        setForm(prev => ({ ...prev, logo: dataUrl }));
      } catch (err) {
        showToast("Failed to read image", "error");
      }
    }
  };

  const nextStep = () => {
    if (!form.name?.trim()) {
      showToast("Organisation name is required", "error");
      return;
    }
    setStep(2);
  };

  const submit = async () => {
    if (!form.name?.trim() || !form.adminUsername?.trim() || !form.adminPassword?.trim()) {
      showToast("Organisation name, admin username and password are required", "error");
      return;
    }
    if (!form.adminEmail?.trim()) {
      showToast("Admin email is required for OTP login and password reset", "error");
      return;
    }
    if (form.adminPassword.length < 4) {
      showToast("Password must be at least 4 characters", "error");
      return;
    }
    setLoading(true);
    try {
      const org = await db.addOrganisation({
        name: form.name.trim(),
        shopName: form.shopName.trim() || null,
        logo: form.logo || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      });
      await db.addOrgAdmin(org.id, {
        username: form.adminUsername.trim(),
        password: form.adminPassword,
        name: form.adminName.trim() || form.adminUsername.trim(),
        email: form.adminEmail.trim() || null,
      });
      setDone(true);
      showToast("Registration submitted. You will be notified when approved.");
    } catch (err) {
      showToast(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-page">
        <div className="register-shell-success">
          <div className="register-success-card">
            <div style={{ width: 72, height: 72, margin: "0 auto 18px", borderRadius: 24, background: "linear-gradient(135deg,#4f67ff,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 50px rgba(79,103,255,.28)" }}>
              <Icon name="check" size={30} color="#fff" />
            </div>
            <div style={{ fontSize: 14, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 800, color: "#6366f1", marginBottom: 10 }}>Registration sent</div>
            <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05, color: "#0f172a", letterSpacing: "-.04em" }}>Your organisation is under review</h2>
            <p style={{ margin: "14px auto 0", maxWidth: 380, color: "#64748b", lineHeight: 1.7 }}>We&apos;ve received your details. Once approved, you&apos;ll be able to sign in and start billing immediately.</p>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => go(window.location.pathname)}>Back to Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ background: "#eef0f6" }}>
      <div className="register-shell">
        <div className="register-marketing">
          <div className="register-brand">
            <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg,#4f67ff,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 44px rgba(79,103,255,.22)" }}>
              <Icon name="billing" size={18} color="#fff" />
            </div>
            <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#5b4ff7" }}>Shiromani Printers</div>
          </div>

          <h1 style={{ margin: 0, fontSize: "3.4rem", lineHeight: .98, letterSpacing: "-.05em", maxWidth: 560, color: "#0b1220" }}>
            Start billing smarter <span style={{ color: "#6c5cff" }}>today</span>
          </h1>
          <p style={{ margin: "22px 0 0", maxWidth: 540, color: "#6b7280", fontSize: "1.05rem", lineHeight: 1.65 }}>
            Join 10,000+ Indian businesses running on Shiromani. Free to start, scales as you grow.
          </p>

          <div className="register-points">
            {[
              "Create your first invoice in under 60 seconds",
              "Bank-grade security with daily encrypted backups",
              "Live reports, GST returns, and insights built in",
            ].map((text, index) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(108,92,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6c5cff", flexShrink: 0 }}>
                  <Icon name={index === 0 ? "billing" : index === 1 ? "lock" : "chart"} size={15} color="#6c5cff" />
                </div>
                <div style={{ color: "#5f6675", fontSize: "1.02rem" }}>{text}</div>
              </div>
            ))}
          </div>

          <div className="register-quote">
            <div style={{ color: "#6b7280", fontSize: "1rem", lineHeight: 1.7, fontStyle: "italic" }}>
              &quot;The best GST billing software I&apos;ve used. Setup was instant and the invoices look very professional.&quot;
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: "linear-gradient(135deg,#6c5cff,#7c3aed)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>R</div>
              <div>
                <div style={{ fontWeight: 800, color: "#111827" }}>Rajesh Gupta</div>
                <div style={{ color: "#6b7280", fontSize: ".92rem" }}>Owner, Gupta Electronics, Ahmedabad</div>
              </div>
            </div>
          </div>
        </div>

        <div className="register-card-wrap">
          <div className="register-card">
            <div className="register-stepbar">
              <div className="register-step">
                <div style={{ width: 32, height: 32, borderRadius: 999, background: step >= 1 ? "#6c5cff" : "#ede9fe", color: step >= 1 ? "#fff" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>1</div>
                <div style={{ fontWeight: 800, color: "#111827" }}>Organisation</div>
              </div>
              <div className="register-divider" />
              <div className="register-step register-step-end">
                <div style={{ width: 32, height: 32, borderRadius: 999, background: step >= 2 ? "#6c5cff" : "#f3f4f6", color: step >= 2 ? "#fff" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>2</div>
                <div style={{ fontWeight: 800, color: "#111827" }}>Account</div>
              </div>
            </div>

            {step === 1 ? (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05, color: "#000", letterSpacing: "-.04em" }}>Tell us about your business</h2>
                <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: "1rem" }}>This helps personalise your invoices and reports.</p>
                <div className="form-grid" style={{ marginTop: 24 }}>
                  <div className="form-group full"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Organisation Name <span style={{ color: "#6c5cff" }}>*</span></label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Traders Pvt. Ltd." style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group full"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Shop / Brand Name <span style={{ color: "#6b7280", fontSize: ".82rem" }}>(optional)</span></label><input value={form.shopName} onChange={e => setForm({ ...form, shopName: e.target.value })} placeholder="Display name on invoices" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group full"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Address <span style={{ color: "#6b7280", fontSize: ".82rem" }}>(optional)</span></label><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Business address for invoices" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group full"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Phone <span style={{ color: "#6b7280", fontSize: ".82rem" }}>(optional)</span></label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98000 00000" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group full"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Logo <span style={{ color: "#6b7280", fontSize: ".82rem" }}>(optional)</span></label><input value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="Paste logo URL or upload below" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /><input type="file" accept="image/*" onChange={handleLogoFile} style={{ marginTop: 8, fontSize: ".84rem", color: "#6b7280" }} /></div>
                </div>
                <button className="btn btn-primary register-primary-wide" onClick={nextStep}>
                  Next Step
                  <span style={{ fontSize: "1rem" }}>→</span>
                </button>
                <div style={{ marginTop: 18, textAlign: "center", color: "#6b7280" }}>
                  Already have an account? <button type="button" onClick={() => go(window.location.pathname)} style={{ border: "none", background: "transparent", color: "#6c5cff", fontWeight: 700, padding: 0 }}>Sign in</button>
                </div>
                <div style={{ marginTop: 10, textAlign: "center", color: "#6b7280", fontSize: ".88rem", lineHeight: 1.6 }}>By creating an account you agree to our Terms of Service and Privacy Policy.</div>
                <div className="register-mobile-back">
                  <button type="button" onClick={() => go(window.location.pathname)} style={{ border: "none", background: "transparent", color: "#6c5cff", fontWeight: 700, padding: 0 }}>
                    Back to sign in
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ margin: 0, fontSize: "2rem", lineHeight: 1.05, color: "#000", letterSpacing: "-.04em" }}>Create your admin account</h2>
                <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: "1rem" }}>This account will manage billing, staff, and customer records.</p>
                <div className="form-grid" style={{ marginTop: 24 }}>
                  <div className="form-group"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Username <span style={{ color: "#6c5cff" }}>*</span></label><input value={form.adminUsername} onChange={e => setForm({ ...form, adminUsername: e.target.value })} placeholder="Choose a login username" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Password <span style={{ color: "#6c5cff" }}>*</span></label><input type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} placeholder="Minimum 4 characters" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Full Name <span style={{ color: "#6b7280", fontSize: ".82rem" }}>(optional)</span></label><input value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} placeholder="Your full name" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                  <div className="form-group"><label style={{ color: "#111827", textTransform: "none", letterSpacing: 0, fontSize: ".98rem" }}>Email <span style={{ color: "#6c5cff" }}>*</span></label><input type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} placeholder="For OTP login and reset" style={{ background: "#fff", borderColor: "#dcdfe7", height: 44 }} /></div>
                </div>
                <div className="register-actions">
                  <button className="btn btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "14px 18px", borderRadius: 12 }} onClick={() => setStep(1)}>Back</button>
                  <button className="btn btn-primary" style={{ flex: 1.2, justifyContent: "center", padding: "14px 18px", borderRadius: 12, background: "linear-gradient(135deg,#6c5cff,#8a6cff)" }} onClick={submit} disabled={loading}>{loading ? "Submitting..." : "Create account"}</button>
                </div>
                <div style={{ marginTop: 16, textAlign: "center", color: "#6b7280", fontSize: ".9rem" }}>You can edit business details later after approval.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Org Approvals (super admin only) ───────────────────────────────────────────
function OrgApprovalsPage({ organisations, onRefresh, showToast }) {
  const [loading, setLoading] = useState(false);
  const [admins, setAdmins] = useState({});
  const [lockReason, setLockReason] = useState({});

  useEffect(() => {
    if (organisations.length === 0) return;
    (async () => {
      const orgIds = organisations.map(o => o.id);
      const { data } = await supabase.from("org_admins").select("organisation_id, username").in("organisation_id", orgIds);
      const map = {};
      (data || []).forEach(a => { if (!map[a.organisation_id]) map[a.organisation_id] = a.username; });
      setAdmins(map);
    })();
  }, [organisations]);

  const handleApprove = async (id) => {
    setLoading(true);
    try {
      await db.approveOrganisation(id);
      showToast("Organisation approved. They can now log in.");
      onRefresh();
    } catch (e) {
      showToast(e.message || "Failed to approve", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id) => {
    setLoading(true);
    try {
      await db.rejectOrganisation(id);
      showToast("Organisation rejected.");
      onRefresh();
    } catch (e) {
      showToast(e.message || "Failed to reject", "error");
    } finally {
      setLoading(false);
    }
  };

  const pending = organisations.filter(o => o.status === "pending");
  const approved = organisations.filter(o => o.status === "approved");

  const handleLock = async (id) => {
    setLoading(true);
    try {
      await db.lockOrganisation(id, lockReason[id] || "Payment due");
      showToast("Organisation locked. Login disabled until unlocked.");
      onRefresh();
    } catch (e) {
      showToast(e.message || "Failed to lock org", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = async (id) => {
    setLoading(true);
    try {
      await db.unlockOrganisation(id);
      showToast("Organisation unlocked. Login enabled.");
      onRefresh();
    } catch (e) {
      showToast(e.message || "Failed to unlock org", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Pending Organisation Registrations</div>
        <p style={{ fontSize: ".85rem", color: "var(--text2)", marginBottom: 16 }}>Approve or reject new organisation sign-ups. Approved orgs can then log in.</p>
        {pending.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>No pending registrations.</div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Org Name</th><th>Shop Name</th><th>Admin Username</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.name}</td>
                  <td>{o.shop_name || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: ".85rem" }}>{admins[o.id] || "—"}</td>
                  <td style={{ fontSize: ".78rem", color: "var(--text3)" }}>{o.created_at ? fmtDate(o.created_at) : "—"}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-success" onClick={() => handleApprove(o.id)} disabled={loading}>Approve</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleReject(o.id)} disabled={loading}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">Approved Organisations (Billing / Lock)</div>
        <p style={{ fontSize: ".85rem", color: "var(--text2)", marginBottom: 16 }}>
          If an organisation doesn’t pay, you can lock it to disable logins for all its users.
        </p>
        {approved.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No approved organisations yet.</div>
        ) : (
          <div className="table-wrap"><table>
            <thead><tr><th>Org Name</th><th>Shop Name</th><th>Status</th><th>Reason</th><th>Actions</th></tr></thead>
            <tbody>
              {approved.map(o => {
                const enabled = o.access_enabled !== false;
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.name}</td>
                    <td>{o.shop_name || "—"}</td>
                    <td>
                      <span className={`badge ${enabled ? "badge-green" : "badge-red"}`}>{enabled ? "Enabled" : "Locked"}</span>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <input
                        placeholder={o.locked_reason || "Payment due"}
                        value={lockReason[o.id] ?? ""}
                        onChange={(e) => setLockReason(r => ({ ...r, [o.id]: e.target.value }))}
                        disabled={loading}
                      />
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {enabled ? (
                          <button className="btn btn-sm btn-danger" onClick={() => handleLock(o.id)} disabled={loading}>Lock</button>
                        ) : (
                          <button className="btn btn-sm btn-success" onClick={() => handleUnlock(o.id)} disabled={loading}>Unlock</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState({ "group-sales": true, "group-items": true });
  const [toast, setToast] = useState(null);
  const [initialDraft, setInitialDraft] = useState(null);
  const [advancedDraft, setAdvancedDraft] = useState(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState(null);
  const [jumpToCustomer, setJumpToCustomer] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Brand / settings — start from in-memory defaults, then hydrate from Supabase in loadAll
  const [brand, setBrandState] = useState(DEFAULT_BRAND);
  const setBrand = (val) => {
    const next = typeof val === "function" ? val(brand) : val;
    setBrandState(next);
    db.saveBrand(next, user?.organisationId ?? undefined);
    // Also persist defaultBillingMethod to localStorage as a reliable fallback.
    // The Supabase settings table may be missing the column, causing saveBrand
    // to silently drop the value. localStorage ensures the preference survives refreshes.
    try { localStorage.setItem("pm_billing_method", next.defaultBillingMethod || "modern"); } catch {}
  };

  const [bills, setBills] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorBills, setVendorBills] = useState([]);
  const [billPayments, setBillPayments] = useState([]);
  const [vendorPayments, setVendorPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [organisations, setOrganisations] = useState([]);
  const [approvedOrganisations, setApprovedOrganisations] = useState([]); // kept for compatibility (no longer used by LoginPage)
  const [products, setProducts] = useState([]);

  const defaultPageForRole = (role, organisationId) => {
    if (role === "vendor") return "vendor-dashboard";
    if (role === "worker") return "worker-dashboard";
    if (role === "admin" && organisationId === null) return "org-approvals"; // Super Admin
    return "dashboard";
  };

  // Restore logged-in user from localStorage (so refresh doesn't log out)
  useEffect(() => {
    (async () => {
      try {
        // Clean up legacy admin password key if present
        localStorage.removeItem("pm_admin_password");

        const raw = localStorage.getItem("pm_user");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.username && parsed.role) {
            // Re-validate session: ensure the org is still approved and accessible
            let valid = true;
            if (parsed.organisationId) {
              try {
                const { data: org } = await supabase
                  .from("organisations")
                  .select("id, status, access_enabled")
                  .eq("id", parsed.organisationId)
                  .eq("status", "approved")
                  .eq("access_enabled", true)
                  .maybeSingle();
                valid = !!org;
              } catch { /* Network error — allow cached session for offline tolerance */ }
            }
            if (valid) {
              setUser(parsed);
              setPage(defaultPageForRole(parsed.role, parsed.organisationId ?? null));
            } else {
              localStorage.removeItem("pm_user");
            }
          }
        }
      } catch (e) {
        console.error("restoreUser:", e);
      }
    })();
  }, []);

  // Allow Login to show even if DB is slow
  useEffect(() => {
    (async () => {
      if (!userRef.current) setDbLoading(false);
    })();
  }, []);

  // Load data when user is set (org-scoped for org users, organisations only for Super Admin)
  useEffect(() => {
    if (!user) return;
    let isMounted = true; // Task 3.5 – prevent state updates after unmount
    const orgId = user.organisationId ?? null;
    async function loadAll() {
      setDbLoading(true);
      if (orgId === null) {
        // Super Admin: only load organisations for approvals panel
        const orgs = await db.getOrganisations();
        if (!isMounted) return;
        setOrganisations(orgs || []);
        setBills([]);
        setPurchases([]);
        setTasks([]);
        setCustomers([]);
        setWorkers([]);
        setVendors([]);
        setVendorBills([]);
        setBillPayments([]);
        setVendorPayments([]);
        setBrandState(DEFAULT_BRAND);
      } else {
        const [b, p, t, c, w, v, vb, bp, vp, dbBrand, pr] = await Promise.all([
          db.getBills(orgId),
          db.getPurchases(orgId),
          db.getTasks(orgId),
          db.getCustomers(orgId),
          db.getWorkers(orgId),
          db.getVendors(orgId),
          db.getVendorBills(orgId),
          db.getBillPayments(orgId),
          db.getVendorPayments(orgId),
          db.loadBrand(DEFAULT_BRAND, orgId),
          db.getProducts(orgId),
        ]);
        if (!isMounted) return; // Task 3.5 – bail if user changed while loading
        setBills(b);
        setPurchases(p);
        setBillPayments(bp || []);
        setVendorPayments(vp || []);
        setTasks(t);
        setCustomers(c);
        setVendors(v || []);
        setVendorBills(vb || []);
        setProducts(pr || []);
        const realWorkers = (w || []).filter(x => x.role === "worker" || x.username !== "admin");
        setWorkers(realWorkers);

        // Brand: start from what we have in Supabase for this org, falling back to DEFAULT_BRAND.
        let baseBrand = dbBrand || DEFAULT_BRAND;
        // Restore defaultBillingMethod from localStorage if the DB column is missing.
        // saveBrand silently retries without optional columns when they don't exist in the
        // settings table yet, so the DB always returns null; localStorage is the true preference.
        try {
          const localMethod = localStorage.getItem("pm_billing_method");
          if (localMethod === "classic" || localMethod === "modern") {
            baseBrand = { ...baseBrand, defaultBillingMethod: localMethod };
          }
        } catch {}
        if (b.length > 0) {
          const salesBills = b.filter(x => x.invoiceType !== "Payment In" && (x.docType || x.doc_type) !== "Payment In");
          const nums = salesBills.map(x => parseInt((x.id || "").split("-")[1] || "0")).filter(n => !isNaN(n));
          const maxNum = Math.max(...nums, 0);
          const merged = { ...baseBrand, invoiceCounter: Math.max(baseBrand.invoiceCounter || 0, maxNum + 1) };
          setBrandState(merged);
          db.saveBrand(merged, orgId);
        } else {
          setBrandState(baseBrand);
          // Always ensure a settings row exists in DB for this org (even if new with no bills yet)
          // so that future changes in Settings page persist correctly on refresh.
          if (!dbBrand) {
            db.saveBrand(baseBrand, orgId);
          }
        }
      }
      setDbLoading(false);
    }
    loadAll();
    return () => { isMounted = false; }; // Task 3.5 – cleanup
  }, [user?.id, user?.organisationId]);


  const showToast = (msg, type = "success") => setToast({ msg, type });
  const addNotification = (msg) => setNotifications(n => {
    // Task 4.5 – cap the array at 100 entries so memory never grows unboundedly
    const MAX_NOTIFICATIONS = 100;
    const updated = [{ id: Date.now(), msg, read: false, time: now() }, ...n];
    return updated.length > MAX_NOTIFICATIONS ? updated.slice(0, MAX_NOTIFICATIONS) : updated;
  });

  // Smart automatic notifications (overdue bills, tasks due soon, today's summary)
  const hasRunSmartNotify = useRef(false);
  useEffect(() => {
    if (user?.id) hasRunSmartNotify.current = false;
  }, [user?.id]);
  useEffect(() => {
    if (!user?.organisationId || dbLoading || hasRunSmartNotify.current) return;
    hasRunSmartNotify.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);

    const overdueBills = bills.filter(b => !b.paid && (b.dueDate || b.due_date) && (b.dueDate || b.due_date) < today);
    if (overdueBills.length > 0) {
      const ids = overdueBills.slice(0, 3).map(b => b.id).join(", ");
      addNotification(`⚠️ ${overdueBills.length} bill(s) overdue: ${ids}${overdueBills.length > 3 ? "…" : ""}`);
    }

    const tasksDueTomorrow = tasks.filter(t => t.deadline === tomorrow && t.status !== "Completed");
    if (tasksDueTomorrow.length > 0) {
      const titles = tasksDueTomorrow.slice(0, 2).map(t => t.title).join(", ");
      addNotification(`📅 ${tasksDueTomorrow.length} task(s) due tomorrow: ${titles}${tasksDueTomorrow.length > 2 ? "…" : ""}`);
    }

    const tasksDueToday = tasks.filter(t => t.deadline === today && t.status !== "Completed");
    if (tasksDueToday.length > 0) {
      const titles = tasksDueToday.slice(0, 2).map(t => t.title).join(", ");
      addNotification(`🔔 ${tasksDueToday.length} task(s) due today: ${titles}${tasksDueToday.length > 2 ? "…" : ""}`);
    }

    const billsToday = bills.filter(b => b.createdAt && b.createdAt.startsWith(today));
    const todaySales = billsToday.reduce((s, b) => s + (b.total || 0), 0);
    if (billsToday.length > 0) {
      addNotification(`💰 Today: ${billsToday.length} bill(s), ${fmtCur(todaySales)} sales`);
    }

    const unpaidVendor = (vendorBills || []).filter(vb => !vb.paid);
    const unpaidVendorTotal = unpaidVendor.reduce((s, b) => s + (b.amount || 0), 0);
    if (unpaidVendor.length > 0) {
      addNotification(`📤 ${unpaidVendor.length} vendor bill(s) pending — ${fmtCur(unpaidVendorTotal)} to pay`);
    }

    // Low stock (simple check on opening_stock)
    const lowStock = (products || []).filter(p => {
      const qty = Number(p.opening_stock ?? p.openingStock ?? 0) || 0;
      return p.active !== false && qty > 0 && qty <= 5;
    });
    if (lowStock.length > 0) {
      const names = lowStock.slice(0, 3).map(p => p.name).join(", ");
      addNotification(`📦 Low stock on ${lowStock.length} item(s): ${names}${lowStock.length > 3 ? "…" : ""}`);
    }
  }, [bills, tasks, vendorBills, products, user?.organisationId, dbLoading]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingTasks = tasks.filter(t => t.status !== "Completed");
  const completedTasks = tasks.filter(t => t.status === "Completed");
  const hasBillPayments = Array.isArray(billPayments) && billPayments.length > 0;
  const paidBills = hasBillPayments
    ? bills.filter(b => getBillPaymentInfo(b, billPayments).isPaid)
    : bills.filter(b => b.paid);
  const unpaidBills = hasBillPayments
    ? bills.filter(b => !getBillPaymentInfo(b, billPayments).isPaid)
    : bills.filter(b => !b.paid);
  const totalRevenue = hasBillPayments
    ? billPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    : bills
        .filter(b => b.docType !== "Quotation" && b.docType !== "Delivery Challan" && b.docType !== "Payment In")
        .reduce((s, b) => s + (b.total || 0), 0);
  const totalPending = hasBillPayments
    ? bills.reduce((s, b) => s + getBillPaymentInfo(b, billPayments).remaining, 0)
    : unpaidBills.reduce((s, b) => s + (b.total || 0), 0);

  const refreshOrganisations = async () => {
    const orgs = await db.getOrganisations();
    setOrganisations(orgs || []);
  };
  useEffect(() => {
    if (user?.role === "admin") refreshOrganisations();
  }, [user?.role]);


  useEffect(() => {
    document.documentElement.classList[dark ? "add" : "remove"]("dark");
  }, [dark]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("pm-close-modal"));
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Navigation + access protection must be defined BEFORE any early returns,
  // otherwise App will call a different number of hooks after login.
  const pendingOrgsCount = (organisations || []).filter(o => o.status === "pending").length;
  const isSuperAdmin = user?.role === "admin" && (user?.organisationId ?? null) == null;
  const navItems = !user ? [] : isSuperAdmin ? [
    { id: "org-approvals", label: "Org Approvals", icon: "admin", badge: pendingOrgsCount },
  ] : user.role === "admin" ? [
    { isSection: true, label: "GENERAL" },
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "live-alerts", label: "Live Alerts 🐒", icon: "alert" },
    { id: "customers", label: "Parties", icon: "customers" },
    { isAccordion: true, id: "group-items", label: "Items", icon: "billing", children: [
        { id: "products", label: "Inventory" },
        { id: "godown", label: "Godown (Warehouse)", disabled: true },
    ]},
    { isAccordion: true, id: "group-sales", label: "Sales", icon: "billing", children: [
        { id: "create-bill", label: "+ Create Bill" },
        { id: "billing", label: "Sales Invoices" },
        { id: "quotation", label: "Quotation / Estimate", docType: "Quotation" },
        { id: "payments", label: "Payment In" },
        { id: "sales-return", label: "Sales Return", docType: "Sales Return" },
        { id: "credit-note", label: "Credit Note", docType: "Credit Note" },
        { id: "billing-challan", label: "Delivery Challan", docType: "Delivery Challan" },
        { id: "proforma-invoice", label: "Proforma Invoice", docType: "Proforma Invoice" },
    ]},
    { isAccordion: true, id: "group-purchases", label: "Purchases", icon: "purchases", children: [
        { id: "purchases", label: "Purchases" }
    ]},
    { isAccordion: true, id: "group-reports", label: "Reports", icon: "chart", children: [
        { id: "reports", label: "Revenue Reports" }
    ]},
    { isSection: true, label: "ACCOUNTING SOLUTIONS" },
    { id: "cash-bank", label: "Cash & Bank", icon: "billing", disabled: true },
    { id: "e-invoice", label: "E-Invoicing", icon: "billing" },
    { id: "automated-bills", label: "Automated Bills", icon: "tasks", disabled: true },
    { id: "expenses", label: "Expenses", icon: "billing", disabled: true },
    { id: "pos", label: "POS Billing", icon: "billing", disabled: true },
    
    { isSection: true, label: "BUSINESS TOOLS" },
    { id: "workers", label: "Staff Attendance & Payroll", icon: "workers" },
    { id: "admin", label: "Manage Users", icon: "admin" },
    { id: "tasks", label: "Task Management", icon: "tasks", badge: pendingTasks.length },

    { isSection: true, label: "MORE APPS" },
    { id: "ai-agent", label: "🤖 AI Agent", icon: "chart" },
    { id: "gst-suite", label: "💼 GST Suite", icon: "billing" },
    { id: "posted-bills", label: "Posted Bills", icon: "billing" },
    { id: "vendors", label: "Vendors", icon: "vendor" },
    { id: "gst-finder", label: "🔍 GST Finder", icon: "billing" },
    { id: "e-waybill", label: "🚛 E-Way Bill", icon: "billing" },
    { id: "gst-filing", label: "📊 GST Filing", icon: "chart" },
    { id: "settings", label: "Settings", icon: "settings" },
  ] : user.role === "vendor" ? [
    { id: "vendor-dashboard", label: "My Dashboard", icon: "dashboard" },
    { id: "vendor-tasks", label: "My Tasks", icon: "tasks" },
    { id: "vendor-bills", label: "Create Bill", icon: "billing" },
  ] : [
    { id: "worker-dashboard", label: "My Dashboard", icon: "dashboard" },
    { id: "worker-tasks", label: "My Tasks", icon: "tasks" },
  ];

  // Protect page access by role (no routing; this prevents manual/accidental navigation to disallowed pages)
  useEffect(() => {
    if (!user) return;
    const flattenedNav = navItems.reduce((acc, item) => item.children ? [...acc, item.id, ...item.children.map(c => c.id)] : [...acc, item.id], []);
    const allowed = new Set(flattenedNav);
    if (!allowed.has(page)) {
      setPage(defaultPageForRole(user.role, user.organisationId ?? null));
    }
  }, [user?.id, user?.role, user?.organisationId, page]);

  // Show the loading screen only after login; public login/register should never get stuck here.
  if (dbLoading && user) return (
    <><style>{CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle at top, rgba(79,103,255,.10), transparent 34%), var(--bg)", padding: 16 }}>
        <AppLoader
          title="Loading your dashboard..."
          subtitle="Connecting to your organisation data and restoring the latest workspace."
        />
      </div>
    </>
  );

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

  if (!user) {
    const showRegister = new URLSearchParams(window.location.search).has("register");
    const path = (window.location.pathname || "/").toLowerCase();
    if (showRegister) {
      return (
        <>
          <style>{CSS}</style>
          <OrgRegistrationPage showToast={showToast} />
          {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </>
      );
    }
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
    // Path-based public routes (no react-router; vercel rewrites all paths to index.html).
    if (path === "/register") {
      return (
        <>
          <style>{CSS}</style>
          <OrgRegistrationPage showToast={showToast} />
          {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </>
      );
    }
    if (path === "/") {
      return (
        <>
          <style>{CSS}</style>
          <LandingPage />
        </>
      );
    }
    return (
      <>
        <style>{CSS}</style>
        <LoginPage
          brand={brand}
          adminPassword={undefined}
          onLogin={u => {
            const simpleUser = { id: u.id, name: u.name, role: u.role, username: u.username, organisationId: u.organisationId ?? null };
            setUser(simpleUser);
            const nextPage = defaultPageForRole(simpleUser.role, simpleUser.organisationId ?? null);
            setPage(nextPage);
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

  // Task 5.4 – Each page is isolated in its own ErrorBoundary so a crash in one
  // view cannot take down the entire application shell.
  const pages = {
    dashboard: <ErrorBoundary name="Dashboard"><ShopDashboard bills={bills} tasks={tasks} workers={workers} vendors={vendors} billPayments={billPayments} totalRevenue={totalRevenue} totalPending={totalPending} paidBills={paidBills} unpaidBills={unpaidBills} pendingTasks={pendingTasks} completedTasks={completedTasks} setPage={setPage} brand={brand} onViewInvoice={setViewingInvoiceId} setAdvancedDraft={setAdvancedDraft} /></ErrorBoundary>,
    "live-alerts": <ErrorBoundary name="Live Alerts"><LiveAlertsPage tasks={tasks} products={products} bills={bills} billPayments={billPayments} onViewCustomer={(c) => { setJumpToCustomer(c); setPage("customers"); }} onNavigate={setPage} /></ErrorBoundary>,
    billing: <ErrorBoundary name="Billing"><SimpleBillingPage bills={bills} setBills={setBills} billPayments={billPayments} setBillPayments={setBillPayments} showToast={showToast} customers={customers} setCustomers={setCustomers} brand={brand} setBrand={setBrand} user={user} products={products} initialDraft={initialDraft} setInitialDraft={setInitialDraft} onViewInvoice={setViewingInvoiceId} setAdvancedDraft={setAdvancedDraft} /></ErrorBoundary>,
    products: <ErrorBoundary name="Products"><EnhancedProductsPage products={products} setProducts={setProducts} showToast={showToast} user={user} /></ErrorBoundary>,
    tasks: <ErrorBoundary name="Tasks"><TasksPage tasks={tasks} setTasks={setTasks} workers={workers} vendors={vendors} user={user} showToast={showToast} addNotification={addNotification} /></ErrorBoundary>,
    workers: <ErrorBoundary name="Staff"><StaffPage workers={workers} vendors={vendors} setWorkers={setWorkers} tasks={tasks} showToast={showToast} user={user} /></ErrorBoundary>,
    vendors: <ErrorBoundary name="Vendors"><VendorsPage vendors={vendors} workers={workers} setVendors={setVendors} vendorBills={vendorBills} setVendorBills={setVendorBills} vendorPayments={vendorPayments} setVendorPayments={setVendorPayments} showToast={showToast} brand={brand} user={user} /></ErrorBoundary>,
    payments: <ErrorBoundary name="Payments"><PaymentsPage bills={bills} setBills={setBills} billPayments={billPayments} setBillPayments={setBillPayments} showToast={showToast} user={user} /></ErrorBoundary>,
    purchases: <ErrorBoundary name="Purchases"><PurchasesPage purchases={purchases} setPurchases={setPurchases} showToast={showToast} user={user} /></ErrorBoundary>,
    "posted-bills": <ErrorBoundary name="Posted Bills"><PostedBillsPage purchases={purchases} setPurchases={setPurchases} showToast={showToast} user={user} /></ErrorBoundary>,
    customers: <ErrorBoundary name="Customers"><EnhancedCustomersPage customers={customers} setCustomers={setCustomers} bills={bills} billPayments={billPayments} showToast={showToast} user={user} setAdvancedDraft={setAdvancedDraft} onViewInvoice={setViewingInvoiceId} jumpToCustomer={jumpToCustomer} setJumpToCustomer={setJumpToCustomer} /></ErrorBoundary>,
    reports: <ErrorBoundary name="Reports"><ReportsPage bills={bills} customers={customers} tasks={tasks} /></ErrorBoundary>,
    "ai-agent": <ErrorBoundary name="AI Agent"><AiAgentPage products={products} bills={bills} customers={customers} showToast={showToast} setBills={setBills} sellerName={user?.name} setPage={setPage} setInitialDraft={setInitialDraft} user={user} /></ErrorBoundary>,
    "org-approvals": <ErrorBoundary name="Org Approvals"><OrgApprovalsPage organisations={organisations} onRefresh={refreshOrganisations} showToast={showToast} /></ErrorBoundary>,
    admin: <ErrorBoundary name="Admin"><AdminPanel bills={bills} tasks={tasks} workers={workers} vendors={vendors} vendorBills={vendorBills} /></ErrorBoundary>,
    settings: <ErrorBoundary name="Settings"><SettingsPage brand={brand} setBrand={setBrand} showToast={showToast} workers={workers} setWorkers={setWorkers} user={user} /></ErrorBoundary>,
    "worker-dashboard": <ErrorBoundary name="Worker Dashboard"><WorkerDashboard tasks={tasks} user={user} /></ErrorBoundary>,
    "worker-tasks": <ErrorBoundary name="Worker Tasks"><WorkerTasks tasks={tasks} setTasks={setTasks} user={user} showToast={showToast} addNotification={addNotification} /></ErrorBoundary>,
    "vendor-dashboard": <ErrorBoundary name="Vendor Dashboard"><VendorDashboard tasks={tasks} user={user} vendorBills={vendorBills} /></ErrorBoundary>,
    "vendor-tasks": <ErrorBoundary name="Vendor Tasks"><VendorTasks tasks={tasks} setTasks={setTasks} user={user} showToast={showToast} addNotification={addNotification} /></ErrorBoundary>,
    "vendor-bills": <ErrorBoundary name="Vendor Bills"><VendorBillsPage vendorBills={vendorBills} setVendorBills={setVendorBills} vendorPayments={vendorPayments} setVendorPayments={setVendorPayments} user={user} showToast={showToast} brand={brand} /></ErrorBoundary>,
    "gst-suite": <ErrorBoundary name="GST Suite"><GstSuitePage setPage={setPage} /></ErrorBoundary>,
    "gst-finder": <ErrorBoundary name="GST Finder"><GstFinderPage user={user} showToast={showToast} /></ErrorBoundary>,
    "e-invoice": <ErrorBoundary name="E-Invoice"><EInvoicePage bills={bills} user={user} showToast={showToast} /></ErrorBoundary>,
    "e-waybill": <ErrorBoundary name="E-Way Bill"><EWayBillPage bills={bills} user={user} showToast={showToast} /></ErrorBoundary>,
    "gst-filing": <ErrorBoundary name="GST Filing"><GstFilingPage bills={bills} user={user} showToast={showToast} /></ErrorBoundary>,
  };

  const titles = { dashboard:"Dashboard", "live-alerts":"Live Alerts 🐒", billing:"Billing", products:"Products / Services", "ai-agent":"🤖 AI Agent", tasks:"Task Management", workers:"Staff & Payroll", vendors:"Vendors", payments:"Payments", purchases:"Purchases", "posted-bills":"Posted Bills", customers:"Customers", reports:"Revenue Reports", "org-approvals":"Org Approvals", admin:"Admin Panel", settings:"Settings", "worker-dashboard":"My Dashboard", "worker-tasks":"My Tasks", "vendor-dashboard":"Vendor Dashboard", "vendor-tasks":"My Tasks", "vendor-bills":"Create Bill", "gst-suite":"💼 GST Suite", "gst-finder":"🔍 GST Finder", "e-invoice":"🧾 E-Invoice Generator", "e-waybill":"🚛 E-Way Bill", "gst-filing":"📊 GST Filing" };

  const outOfStockProducts = (products || []).filter(p => {
     const qty = Number(p.opening_stock ?? p.openingStock ?? 0);
     return qty === 0 && p.active !== false && p.category !== "service";
  });
  // ── Dynamic appearance styles ─────────────────────────────────────────────
  const appearanceStyle = (() => {
    const parts = [];
    if (brand.bgImage) {
      parts.push(
        `.app-layout{background-image:url('${brand.bgImage}');background-size:cover;background-position:center;background-attachment:fixed;}`,
        `.main-content{background:${brand.bgColor ? brand.bgColor + 'cc' : 'rgba(244,246,250,0.88)'};backdrop-filter:${brand.bgBlur ? 'blur(18px)' : 'none'};min-height:100vh;}`,
        `.dark .main-content{background:${brand.bgColor ? brand.bgColor + 'cc' : 'rgba(12,18,34,0.88)'};}`,
        `.topbar{background:${brand.bgColor ? brand.bgColor + 'dd' : 'rgba(255,255,255,0.90)'};backdrop-filter:blur(12px);}`,
        `.dark .topbar{background:${brand.bgColor ? brand.bgColor + 'dd' : 'rgba(21,27,45,0.90)'};}`,
      );
    } else if (brand.bgColor) {
      parts.push(`.app-layout{background:${brand.bgColor}!important;}`);
    }
    if (brand.sidebarColor) {
      parts.push(
        `.sidebar{background:${brand.sidebarColor}!important;}`,
        `.s-logo{border-bottom-color:${brand.sidebarColor};filter:brightness(0.85);}`,
        `.s-footer{border-top-color:${brand.sidebarColor};filter:brightness(0.85);}`,
        `.nav-item:hover{background:rgba(255,255,255,0.12)!important;}`,
        `.user-chip{background:rgba(255,255,255,0.10)!important;}`,
      );
    }
    return parts.join('');
  })();

  // Task 5.1 – Context values passed to AppProvider so descendant components
  // can opt-in to useAuth() / useData() without needing these props drilled down.
  const authValue = { user, setUser, page, setPage, dark, setDark, showToast, notifications, setNotifications, dbLoading };
  const dataValue = { bills, setBills, customers, setCustomers, workers, setWorkers, vendors, setVendors, tasks, setTasks, purchases, setPurchases, products, setProducts, vendorBills, setVendorBills, billPayments, setBillPayments, vendorPayments, setVendorPayments, organisations, setOrganisations, brand, setBrand };

  return (
    <AppProvider auth={authValue} data={dataValue}>
    <><style>{CSS}</style>{appearanceStyle && <style>{appearanceStyle}</style>}
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
            {navItems.map((item, idx) => {
              if (item.isSection) {
                return <div key={'sec'+idx} className="s-sec" style={{ marginTop: 12 }}>{item.label}</div>;
              }
              if (item.isAccordion) {
                 const isExp = expandedNav[item.id];
                 return (
                   <div key={item.id}>
                      <div className={`nav-item`} onClick={() => {
                        setViewingInvoiceId(null);
                        if (item.children) setExpandedNav(prev => ({...prev, [item.id]: !prev[item.id]}));
                        else { setPage(item.id); setSidebarOpen(false); }
                      }}>
                         <Icon name={item.icon} size={16} />
                         {item.label}
                         {item.badge}
                         <span style={{marginLeft:"auto", opacity:0.6, fontSize:10, transform: isExp ? "rotate(180deg)" : "none", transition:"transform 0.2s"}}>▼</span>
                      </div>
                      <div style={{ 
                        overflow: "hidden", 
                        transition: "max-height 0.3s ease, opacity 0.3s ease, margin 0.3s ease",
                        maxHeight: isExp ? "1000px" : "0",
                        opacity: isExp ? 1 : 0,
                        margin: isExp && item.children?.length > 0 ? "4px 0 8px 0" : "0"
                      }}>
                        <div style={{ paddingLeft: 16, borderLeft: "2px solid rgba(255,255,255,0.05)", marginLeft: 21 }}>
                           {item.children.map(child => (
                             <div key={child.id}
                               className={`nav-item ${page === child.id ? "active" : ""}`}
                               style={{ padding: "8px 12px", fontSize: "0.8rem", opacity: child.disabled ? 0.4 : 1, margin: "2px 0" }}
                               onClick={() => {
                                 setViewingInvoiceId(null);
                                 if (child.disabled) return;
                                 if (child.id === "create-bill" || child.docType) {
                                    const requestedDocType = child.docType || "Tax Invoice (GST)";
                                    if (brand?.defaultBillingMethod === "classic") {
                                       setInitialDraft({ docType: requestedDocType });
                                       setPage("billing");
                                    } else {
                                       setAdvancedDraft({ docType: requestedDocType });
                                    }
                                    setSidebarOpen(false);
                                    return;
                                 }

                                 setPage(child.id);
                                 setSidebarOpen(false);
                               }}
                             >
                               {child.label}
                               {child.badgeText && <span style={{marginLeft:"auto", background:"#EF4444", color:"#fff", fontSize:"10px", padding:"2px 6px", borderRadius:4}}>{child.badgeText}</span>}
                             </div>
                           ))}
                        </div>
                      </div>
                   </div>
                 )
              }
              
              return (
                <div
                  key={item.id}
                  className={`nav-item ${page === item.id ? "active" : ""}`}
                  onClick={() => {
                    setViewingInvoiceId(null);
                    if (item.disabled) return;
                    setPage(item.id);
                    setSidebarOpen(false);
                  }}
                  style={{ opacity: item.disabled ? 0.5 : 1 }}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                  {item.badge > 0 && <span className="nbadge">{item.badge}</span>}
                  {item.badgeText && <span style={{marginLeft:"auto", background:"#EF4444", color:"#fff", fontSize:"10px", padding:"2px 6px", borderRadius:4}}>{item.badgeText}</span>}
                </div>
              );
            })}
          </nav>
          <div className="s-footer">
            <div className="user-chip" onClick={() => {
              setUser(null);
              localStorage.removeItem("pm_user");
              localStorage.removeItem("pm_admin_password");
              setPage("dashboard");
            }}>
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
            <div className="flex gap-2 items-center">
              <button className="btn btn-icon btn-ghost" onClick={() => setDark(!dark)}><Icon name={dark ? "sun" : "moon"} size={16} /></button>
              <button className="btn btn-icon btn-ghost" style={{ position: "relative" }} onClick={() => setNotifications(n => n.map(x => ({ ...x, read: true })))}>
                <Icon name="bell" size={16} />
                {unreadCount > 0 && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, background: "var(--danger)", borderRadius: "50%", border: "2px solid var(--surface)" }} />}
              </button>
            </div>
          </header>
          {outOfStockProducts.length > 0 && (
             <div style={{ background: "#fffbea", borderBottom: "1px solid #fde68a", padding: "5px 0", flexShrink: 0, display: "flex", alignItems: "center" }}>
               <marquee scrollamount="5" style={{ color: "#92400e", fontWeight: "600", fontSize: "0.85rem", letterSpacing: "-0.01em" }}>
                 ⚠️ Low Stock Alert: {outOfStockProducts.map(p => p.name || p.id).join("  ·  ")}
               </marquee>
             </div>
          )}
          <div className="page">
            {viewingInvoiceId ? (
              <InvoiceDetailsView 
                invId={viewingInvoiceId} 
                onClose={() => setViewingInvoiceId(null)}
                onPaymentSaved={(saved) => {
                  if (!saved) return;
                  setBillPayments(prev => [saved, ...prev]);
                  const bill = bills.find(b => b.id === (saved.bill_id || saved.billId));
                  if (bill) {
                    const info = getBillPaymentInfo(bill, [saved, ...(billPayments || [])]);
                    if (info.isPaid) {
                      setBills(bs => bs.map(x => x.id === bill.id ? { ...x, paid: true } : x));
                      db.updateBillPaid(bill.id, true);
                    }
                  }
                }}
              />
            ) : (
              pages[page] || null
            )}
          </div>
        </div>
      </div>
      {/* ── Global Overlays: modals, toasts, voice assistant ── */}
      {advancedDraft?.docType && (
        (advancedDraft.docType === "Payment In" || advancedDraft.doc_type === "Payment In") ? (
           <PaymentInBuilder
               advancedDraft={advancedDraft}
               onClose={() => setAdvancedDraft(null)}
               onSave={async (payload) => {
                   try {
                      const newBill = {
                          ...payload,
                          organisationId: user?.organisationId,
                          desc: payload.desc || "Payment In Received"
                      };
                      const saved = await db.addBill(newBill);
                      if (!saved) throw new Error("Failed to save to database");
                      setBills(prev => [saved, ...prev]);

                      // Allocate payment FIFO to oldest unpaid invoices
                      let remaining = Number(payload.total) || 0;
                      const customerName = payload.customer;
                      const unpaidInvoices = (bills || [])
                        .filter(b => {
                          const dt = b.docType || b.doc_type || "";
                          const isInvoice = !dt || dt === "Invoice" || dt === "Tax Invoice" ||
                                            dt === "Bill of Supply" || dt === "Supply";
                          if (!isInvoice || b.customer !== customerName) return false;
                          const info = getBillPaymentInfo(b, billPayments || []);
                          return !info.isPaid && info.remaining > 0;
                        })
                        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

                      const newPayments = [];
                      for (const inv of unpaidInvoices) {
                        if (remaining <= 0) break;
                        const info = getBillPaymentInfo(inv, billPayments || []);
                        const allocate = Math.min(remaining, info.remaining);
                        const pmt = await db.addBillPayment({
                          billId: inv.id,
                          organisationId: user?.organisationId,
                          method: payload.terms || "cash",
                          amount: allocate,
                          note: `From Payment In ${saved.id}`,
                        });
                        if (pmt) { newPayments.push(pmt); remaining -= allocate; }
                      }
                      if (newPayments.length > 0) {
                        setBillPayments(prev => [...newPayments, ...(prev || [])]);
                        for (const inv of unpaidInvoices) {
                          const pmtsForInv = newPayments.filter(p => (p.bill_id || p.billId) === inv.id);
                          if (!pmtsForInv.length) continue;
                          const info = getBillPaymentInfo(inv, [...pmtsForInv, ...(billPayments || [])]);
                          if (info.isPaid) {
                            setBills(bs => bs.map(x => x.id === inv.id ? { ...x, paid: true } : x));
                            await db.updateBillPaid(inv.id, true);
                          }
                        }
                      }

                      setAdvancedDraft(null);
                      playSuccessSound();
                      showToast("Payment saved successfully!");
                   } catch(e) {
                      console.error("Error saving payment: " + e.message);
                      showToast("Error saving payment: " + e.message, "error");
                   }
               }}
               customers={customers}
               userDetails={user}
               bills={bills}
               billPayments={billPayments}
           />
        ) : (
          <AdvancedInvoiceBuilder 
              initialData={advancedDraft} 
              customers={customers}
              products={products}
              bills={bills}
              brand={brand}
              user={user}
              onClose={() => setAdvancedDraft(null)}
              onSave={async (payload) => {
                  try {
                      // Map fields to what the database (or old simple billing payload) expects
                      const descStr = payload.items && payload.items.length > 0 ? payload.items[0].name || "Products" : "Products";
                      const newBill = { 
                          ...payload, 
                          dateStr: payload.date || new Date().toISOString(),
                          desc: descStr,
                          qty: 1,
                          rate: payload.subtotal,
                          gstAmt: payload.totalTax,
                          gst: payload.totalTax > 0,
                          paid: false
                      };
                      const saved = await db.addBill(newBill);
                      
                      // Also add item payment info if any
                      if (payload.amountReceived > 0) {
                          await db.addBillPayment({
                              billId: saved.id,
                              organisationId: saved.organisation_id,
                              method: payload.paymentMode || "cash",
                              amount: payload.amountReceived,
                              note: "Initial payment with invoice"
                          });
                          // Re-fetch or at least mark paid if >= total
                          if (payload.amountReceived >= payload.total) {
                              saved.paid = true;
                              await db.updateBillPaid(saved.id, true);
                          }
                          playSuccessSound();
                      }
                      
                      setBills(prev => {
                          const existingIndex = prev.findIndex(b => b.id === saved.id);
                          if (existingIndex >= 0) {
                              const next = [...prev];
                              next[existingIndex] = saved;
                              return next;
                          }
                          return [saved, ...prev];
                      });
                      setAdvancedDraft(null);
                      showToast("Document saved successfully!");
                  } catch (e) {
                      showToast("Error saving document: " + e.message, "error");
                  }
              }}
          />
        )
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <VoiceAssistant
        products={products}
        bills={bills}
        customers={customers}
        user={user}
        setPage={setPage}
        setJumpToCustomer={setJumpToCustomer}
        setAdvancedDraft={setAdvancedDraft}
        addVoiceTask={async (taskPayload) => {
          const task = {
            id: "T" + Date.now().toString().slice(-4),
            status: "Pending",
            createdAt: now(),
            title: taskPayload.title || "New Task",
            customer: taskPayload.customer || "",
            deadline: taskPayload.deadline || "",
            notes: taskPayload.notes || "",
            worker: null,
            vendor: null,
            organisationId: user?.organisationId,
          };
          try {
            const saved = await db.addTask(task);
            setTasks(t => [saved || task, ...t]);
            showToast("Task assigned via Voice Assistant");
            return true;
          } catch (e) {
            showToast("Error adding task: " + e.message, "error");
            return false;
          }
        }}
      />
      </>
    </AppProvider>
  );
}

// ── Login (single page for everyone) ──────────────────────────────────────────
function LoginPage({ brand, onLogin }) {
  const [mode, setMode] = useState("username"); // username | email
  const [form, setForm] = useState({ username: "", password: "" });
  const [emailAuth, setEmailAuth] = useState({ email: "", otp: "", step: "enterEmail" }); // enterEmail | enterOtp
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState({ open: false, email: "", otp: "", step: "enterEmail", newPass: "" }); // enterEmail | enterOtp | setPass
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [titleOffset, setTitleOffset] = useState({ x: 0, y: 0 });
  const pageRef = useRef(null);
  const btnRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    const el = pageRef.current;
    const btn = btnRef.current;
    const titleEl = titleRef.current;
    if (!el) return;
    const isDesktopLike = typeof window !== "undefined" && window.matchMedia("(min-width: 980px) and (pointer: fine)").matches;
    if (!isDesktopLike) {
      setCursorVisible(false);
      setBtnOffset({ x: 0, y: 0 });
      setTitleOffset({ x: 0, y: 0 });
      return;
    }
    const onMove = (e) => {
      setCursorVisible(true);
      setMouse({ x: e.clientX, y: e.clientY });
      if (btn) {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) * 0.06;
        const dy = (e.clientY - centerY) * 0.06;
        setBtnOffset({ x: Math.max(-12, Math.min(12, dx)), y: Math.max(-8, Math.min(8, dy)) });
      }
      if (titleEl) {
        const rect = titleEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = (e.clientX - centerX) * 0.028;
        const dy = (e.clientY - centerY) * 0.028;
        setTitleOffset({ x: Math.max(-14, Math.min(14, dx)), y: Math.max(-10, Math.min(10, dy)) });
      }
    };
    const onLeave = () => { setBtnOffset({ x: 0, y: 0 }); setTitleOffset({ x: 0, y: 0 }); setCursorVisible(false); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
  }, []);

  const go = async () => {
    setLoading(true);
    setErr("");
    try {
      const u = await db.loginWithCredentials(form.username, form.password);
      if (u) {
        onLogin(u);
      } else {
        setErr("Invalid credentials, or your organisation is locked.");
      }
    } catch (e) {
      setErr(e.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = async () => {
    const email = (emailAuth.email || "").trim().toLowerCase();
    if (!email) return setErr("Enter your email.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Prevent accidental sign-ups (which trigger "confirmation_requested")
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      setEmailAuth(s => ({ ...s, email, step: "enterOtp" }));
    } catch (e) {
      setErr(e.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    const email = (emailAuth.email || "").trim().toLowerCase();
    const token = (emailAuth.otp || "").trim();
    if (!email || !token) return setErr("Enter email and OTP.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw new Error(error.message);

      // Map Supabase-authenticated email -> app user (org_admins / workers / vendors).
      const orgAdmin = await supabase
        .from("org_admins")
        .select("id, username, name, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle();
      const worker = !orgAdmin.data ? await supabase
        .from("workers")
        .select("id, username, name, role, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle() : { data: null };
      const vendor = (!orgAdmin.data && !worker.data) ? await supabase
        .from("vendors")
        .select("id, username, name, firm_name, email, organisation_id, organisations(status, access_enabled)")
        .eq("email", email)
        .limit(1)
        .maybeSingle() : { data: null };

      const allowedOrg = (org) => org && org.status === "approved" && org.access_enabled !== false;
      if (orgAdmin.data && allowedOrg(orgAdmin.data.organisations)) {
        onLogin({
          id: orgAdmin.data.id,
          username: orgAdmin.data.username,
          role: "admin",
          name: orgAdmin.data.name || orgAdmin.data.username,
          organisationId: orgAdmin.data.organisation_id,
        });
        return;
      }
      if (worker.data && allowedOrg(worker.data.organisations)) {
        onLogin({
          id: worker.data.id,
          username: worker.data.username,
          role: worker.data.role || "worker",
          name: worker.data.name || worker.data.username,
          organisationId: worker.data.organisation_id,
        });
        return;
      }
      if (vendor.data && allowedOrg(vendor.data.organisations)) {
        onLogin({
          id: vendor.data.id,
          username: vendor.data.username,
          role: "vendor",
          name: vendor.data.name || vendor.data.firm_name || vendor.data.username,
          organisationId: vendor.data.organisation_id,
        });
        return;
      }

      await supabase.auth.signOut();
      setErr("This email is not linked to an approved organisation, or the organisation is locked.");
    } catch (e) {
      setErr(e.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const startForgot = () => setForgot({ open: true, email: "", otp: "", step: "enterEmail", newPass: "" });
  const closeForgot = () => setForgot(f => ({ ...f, open: false }));

  const sendForgotOtp = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    if (!email) return setErr("Enter your email.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(error.message);
      setForgot(f => ({ ...f, email, step: "enterOtp" }));
    } catch (e) {
      setErr(e.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const verifyForgotOtp = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    const token = (forgot.otp || "").trim();
    if (!email || !token) return setErr("Enter email and OTP.");
    setLoading(true);
    setErr("");
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw new Error(error.message);
      setForgot(f => ({ ...f, step: "setPass" }));
    } catch (e) {
      setErr(e.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const setNewPassword = async () => {
    const email = (forgot.email || "").trim().toLowerCase();
    const np = (forgot.newPass || "").trim();
    if (np.length < 4) return setErr("Password must be at least 4 characters.");
    setLoading(true);
    setErr("");
    try {
      // Hash the new password server-side before writing to any table
      const { hashPasswordForStorage } = await import("./supabase.js");
      const hashed = await hashPasswordForStorage(np);
      const up1 = await supabase.from("org_admins").update({ password: hashed }).eq("email", email);
      if (up1.error) throw new Error(up1.error.message);
      if ((up1.count || 0) === 0) {
        const up2 = await supabase.from("workers").update({ password: hashed }).eq("email", email);
        if (up2.error) throw new Error(up2.error.message);
        if ((up2.count || 0) === 0) {
          const up3 = await supabase.from("vendors").update({ password: hashed }).eq("email", email);
          if (up3.error) throw new Error(up3.error.message);
          if ((up3.count || 0) === 0) throw new Error("No account found for this email.");
        }
      }
      await supabase.auth.signOut();
      closeForgot();
    } catch (e) {
      setErr(e.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" ref={pageRef}>
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />
      <div className="login-bg-orb login-bg-orb-3" />
      <div className="login-side-accent" />
      <div className="login-cursor-ring" style={{ left: mouse.x, top: mouse.y, opacity: cursorVisible ? 0.6 : 0 }} />
      <div
        className="login-credit login-credit-follow"
        style={{ left: mouse.x, top: mouse.y, opacity: cursorVisible ? 1 : 0, visibility: cursorVisible ? "visible" : "hidden" }}
      >
        <div className="login-credit-inner">
          <span className="login-credit-label">Made by</span>
          <span className="login-credit-name">Nihal Chhabra</span>
        </div>
      </div>
      <div className="login-shell">
        <div className="login-card">
        <div className="login-header-wrap" ref={titleRef} style={{ transform: `translate(${titleOffset.x}px, ${titleOffset.y}px)` }}>
          <p className="login-welcome">Welcome to</p>
          {brand.logo ? <img src={brand.logo} alt="logo" className="login-logo-img" />
            : <div className="login-logo-placeholder"><Icon name="printer" size={26} color="#fff" /></div>}
          <h1 className="login-shop-name">{brand.shopName}</h1>
          <p className="login-subtitle">Billing & Business Management System</p>
        </div>
        <div className="card">
          <div className="segmented" style={{ marginBottom: 14 }}>
            <button className={`segmented-btn ${mode === "username" ? "active" : ""}`} onClick={() => { setMode("username"); setErr(""); }}>
              Username
            </button>
            <button className={`segmented-btn ${mode === "email" ? "active" : ""}`} onClick={() => { setMode("email"); setErr(""); }}>
              Email OTP
            </button>
          </div>

          {mode === "username" ? (
            <>
              <div className="form-group mb-4">
                <label htmlFor="login-username">Username</label>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  placeholder="admin"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && go()}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div className="form-group mb-2">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && go()}
                  style={{ fontSize: 16 }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn btn-ghost btn-sm" onClick={startForgot} type="button">Forgot password?</button>
              </div>
              {err && <div style={{ color: "var(--danger)", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
              <div className="login-btn-wrap" style={{ transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)` }} ref={btnRef}>
                <button className="btn btn-primary login-btn-magnetic" style={{ width: "100%", justifyContent: "center" }} onClick={go} disabled={loading}>
                  {loading ? "Signing in…" : "Sign In"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="form-group mb-4">
                <label>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={emailAuth.email}
                  onChange={e => setEmailAuth(s => ({ ...s, email: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && (emailAuth.step === "enterEmail" ? sendEmailOtp() : verifyEmailOtp())}
                  style={{ fontSize: 14, textTransform: "none" }}
                />
              </div>
              {emailAuth.step === "enterOtp" && (
                <div className="form-group mb-4">
                  <label>OTP</label>
                  <input
                    inputMode="numeric"
                    placeholder="Enter OTP"
                    value={emailAuth.otp}
                    onChange={e => setEmailAuth(s => ({ ...s, otp: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && verifyEmailOtp()}
                    style={{ fontSize: 16 }}
                  />
                </div>
              )}
              {err && <div style={{ color: "var(--danger)", fontSize: ".8rem", marginBottom: 12 }}>{err}</div>}
              <div className="login-btn-wrap" style={{ transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)` }} ref={btnRef}>
                {emailAuth.step === "enterEmail" ? (
                  <button className="btn btn-primary login-btn-magnetic" style={{ width: "100%", justifyContent: "center" }} onClick={sendEmailOtp} disabled={loading}>
                    {loading ? "Sending…" : "Send OTP"}
                  </button>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button className="btn btn-ghost" onClick={() => setEmailAuth(s => ({ ...s, step: "enterEmail", otp: "" }))} disabled={loading}>Change Email</button>
                    <button className="btn btn-primary login-btn-magnetic" onClick={verifyEmailOtp} disabled={loading}>
                      {loading ? "Verifying…" : "Verify OTP"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="divider" />
          <div style={{ fontSize: ".72rem", color: "var(--text3)", textAlign: "center", marginTop: 10 }}>
            New organisation? <a href="?register" style={{ color: "var(--accent)", textDecoration: "underline" }}>Register here</a>
          </div>
        </div>
      </div>

        <div className="login-hero" aria-label="Product preview panel">
          <div className="login-hero-top">
            <div className="login-hero-badge">
              <span style={{ width: 8, height: 8, borderRadius: 99, background: "#22c55e" }} />
              Live preview • invoices • payments
            </div>
            <div style={{ fontWeight: 900, color: "rgba(226,232,240,.86)", fontSize: 12 }}>Works on mobile + desktop</div>
          </div>
          <div className="login-hero-shot">
            <img src="/hero-billing.svg" alt="Billing software preview" loading="eager" />
          </div>
          <div className="login-hero-points">
            <div className="login-hero-point">
              <b>One‑click share</b>
              <span>Send invoice on WhatsApp & Email automatically.</span>
            </div>
            <div className="login-hero-point">
              <b>Track dues</b>
              <span>Paid/unpaid, partial payments, reminders.</span>
            </div>
            <div className="login-hero-point">
              <b>Customers</b>
              <span>Customer list auto-created from bills.</span>
            </div>
            <div className="login-hero-point">
              <b>Reports</b>
              <span>Revenue, pending dues, daily summary.</span>
            </div>
          </div>
        </div>
      </div>

      {forgot.open && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeForgot()}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <div className="modal-title">Reset Password (OTP)</div>
              <button className="btn btn-icon btn-ghost" onClick={closeForgot}><Icon name="x" size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 12 }}>
                We will send an OTP to your email. After verification, you can set a new password for your account.
              </div>
              <div className="form-group mb-4">
                <label>Email</label>
                <input type="email" value={forgot.email} onChange={e => setForgot(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" style={{ textTransform: "none" }} />
              </div>
              {forgot.step !== "enterEmail" && (
                <div className="form-group mb-4">
                  <label>OTP</label>
                  <input inputMode="numeric" value={forgot.otp} onChange={e => setForgot(f => ({ ...f, otp: e.target.value }))} placeholder="Enter OTP" />
                </div>
              )}
              {forgot.step === "setPass" && (
                <div className="form-group mb-2">
                  <label>New Password</label>
                  <input type="password" value={forgot.newPass} onChange={e => setForgot(f => ({ ...f, newPass: e.target.value }))} placeholder="Min 4 characters" />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeForgot} disabled={loading}>Cancel</button>
              {forgot.step === "enterEmail" ? (
                <button className="btn btn-primary" onClick={sendForgotOtp} disabled={loading}>{loading ? "Sending…" : "Send OTP"}</button>
              ) : forgot.step === "enterOtp" ? (
                <button className="btn btn-primary" onClick={verifyForgotOtp} disabled={loading}>{loading ? "Verifying…" : "Verify OTP"}</button>
              ) : (
                <button className="btn btn-primary" onClick={setNewPassword} disabled={loading}>{loading ? "Saving…" : "Update Password"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function DashboardPage({ bills, tasks, workers, vendors, billPayments, totalRevenue, totalPending, paidBills, unpaidBills, pendingTasks, completedTasks, setPage, brand }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const overdueBills = bills.filter(b => !getBillPaymentInfo(b, billPayments).isPaid && (b.dueDate || b.due_date) && (b.dueDate || b.due_date) < todayStr);
  const billsToday = bills.filter(b => b.createdAt && b.createdAt.startsWith(todayStr));
  const todayBillsCount = billsToday.length;
  const todaySales = billsToday.reduce((s, b) => s + (b.total || 0), 0);
  const todayPaymentsReceived = (billPayments || []).filter(p => (p.paidAt || p.paid_at || "").toString().startsWith(todayStr)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const tasksCompletedToday = tasks.filter(t => t.status === "Completed" && t.createdAt && t.createdAt.startsWith(todayStr)).length;
  const partialBills = bills.filter(b => getBillPaymentInfo(b, billPayments).status === "Partially Paid");
  const methodTotals = (billPayments || []).reduce((acc, p) => { const m = (p.method || "cash").toLowerCase(); acc[m] = (acc[m] || 0) + (Number(p.amount) || 0); return acc; }, {});
  const workerStats = workers.map(w => ({ worker: w, completed: tasks.filter(t => (t.worker === w.id || t.worker_id === w.id) && t.status === "Completed").length })).sort((a, b) => b.completed - a.completed);

  const stats = [
    { label: "Total Orders", value: bills.length, icon: "billing", c1: "#4f67ff", c2: "#7c3aed", sub: "All time" },
    { label: "Pending Tasks", value: pendingTasks.length, icon: "tasks", c1: "#f59e0b", c2: "#ef4444", sub: `${completedTasks.length} completed` },
    { label: "Revenue Received", value: fmtCur(totalRevenue), icon: "payment", c1: "#10b981", c2: "#059669", sub: `${paidBills.length} paid` },
    { label: "Pending Payment", value: fmtCur(totalPending), icon: "chart", c1: "#ef4444", c2: "#dc2626", sub: `${unpaidBills.length + partialBills.length} bills · ${overdueBills.length} overdue` },
    { label: "Total Customers", value: bills.reduce((set, b) => (b.customer ? set.add(b.customer) : set), new Set()).size, icon: "customers", c1: "#8b5cf6", c2: "#6d28d9", sub: "Registered" },
    { label: "Completed Tasks", value: completedTasks.length, icon: "check", c1: "#06b6d4", c2: "#0891b2", sub: "This month" },
  ];
  const todayStats = [
    { label: "Bills Today", value: todayBillsCount, icon: "billing", c1: "#0ea5e9", c2: "#0369a1", sub: "Created today" },
    { label: "Today Sales", value: fmtCur(todaySales), icon: "payment", c1: "#22c55e", c2: "#16a34a", sub: "Based on today’s bills" },
    { label: "Payments Received Today", value: fmtCur(todayPaymentsReceived), icon: "payment", c1: "#f97316", c2: "#ea580c", sub: "Approx. from paid bills" },
    { label: "Tasks Completed Today", value: tasksCompletedToday, icon: "check", c1: "#a855f7", c2: "#7c3aed", sub: "Marked completed today" },
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
      <div className="stats-grid" style={{ marginTop: 12 }}>
        {todayStats.map((s, i) => (
          <div key={i} className="stat-card" style={{ "--c1": s.c1, "--c2": s.c2 }}>
            <div style={{ marginBottom: 8 }}><Icon name={s.icon} size={22} color={s.c1} /></div>
            <div className="stat-value" style={{ fontSize: typeof s.value === "string" && s.value.length > 8 ? "1.05rem" : "1.5rem" }}>{s.value}</div>
            <div className="stat-label">{s.label} (Today)</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, alignItems: "start" }}>
        <div className="card">
          <div className="card-title">Payment Methods</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {["cash","upi","bank","card"].filter(m => (methodTotals[m] || 0) > 0).map(m => (
              <div key={m} style={{ padding: "8px 14px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: ".82rem" }}>
                <div style={{ color: "var(--text3)", textTransform: "capitalize" }}>{m}</div>
                <div className="font-mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{fmtCur(methodTotals[m])}</div>
              </div>
            ))}
            {Object.keys(methodTotals).length === 0 && <div style={{ fontSize: ".8rem", color: "var(--text3)" }}>No payments recorded yet</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Worker Performance</div>
          <div className="table-wrap"><table><thead><tr><th>Worker</th><th>Tasks completed</th></tr></thead><tbody>
            {workerStats.slice(0, 5).map(({ worker, completed }) => <tr key={worker.id}><td style={{ fontWeight: 600 }}>{worker.name}</td><td className="font-mono" style={{ fontWeight: 700, color: "var(--accent)" }}>{completed}</td></tr>)}
            {workerStats.length === 0 && <tr><td colSpan={2} style={{ textAlign: "center", color: "var(--text3)", padding: 16 }}>No workers yet</td></tr>}
          </tbody></table></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start", marginTop: 16 }}>
        <div className="card">
          <div className="card-title">Recent Bills</div>
          <div className="table-wrap"><table><thead><tr><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {bills.slice(0, 5).map(b => { const info = getBillPaymentInfo(b, billPayments); const badgeClass = info.isPaid ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red"; return <tr key={b.id}><td><div style={{ fontWeight: 600, fontSize: ".82rem" }}>{b.customer}</div><div style={{ fontSize: ".68rem", color: "var(--text3)" }}>{b.id}</div></td><td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.total)}</td><td><span className={`badge ${badgeClass}`}>{info.status}</span></td></tr>; })}
          </tbody></table></div>
        </div>
        <div className="card">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Recent Tasks</span>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setPage("tasks")}
            >
              View all
            </button>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Task</th><th>Worker</th><th>Status</th></tr></thead><tbody>
            {tasks.slice(0, 5).map(t => { const sc = t.status==="Completed"?"badge-green":t.status==="In Progress"?"badge-blue":"badge-yellow"; return <tr key={t.id}><td style={{ fontWeight: 600 }}>{t.title}</td><td style={{ fontSize: ".78rem", color: "var(--text2)" }}>{t.worker ? (workers.find(w=>w.id===t.worker)?.name||t.worker) : (vendors?.find(v=>v.id===t.vendor)?.name||t.vendor||"—")}</td><td><span className={`badge ${sc}`}>{t.status}</span></td></tr>; })}
          </tbody></table></div>
        </div>
      </div>
    </div>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────
function SettingsPage({ brand, setBrand, showToast, workers, setWorkers, user }) {
  const [f, setF] = useState({ ...brand });
  useEffect(() => { setF({ ...brand }); }, [brand]);
  const logoRef = useRef(); const qrRef = useRef(); const a4PreviewRef = useRef(null);
  const bgImageRef = useRef();
  const [passForm, setPassForm] = useState({ current:"", newPass:"", confirm:"" });
  const [passErr, setPassErr] = useState("");
  const [passLoading, setPassLoading] = useState(false);

  const changeMyPassword = async () => {
    setPassErr("");
    if (!passForm.current || !passForm.newPass || !passForm.confirm) return setPassErr("All fields required.");
    if (passForm.newPass !== passForm.confirm) return setPassErr("New passwords don't match.");
    if (passForm.newPass.length < 4) return setPassErr("Password must be at least 4 characters.");
    setPassLoading(true);
    try {
      // Verify current password via server-side auth (no plaintext comparison on client)
      const verified = await db.loginWithCredentials(user.username, passForm.current);
      if (!verified) { setPassErr("Current password is incorrect."); return; }
      // Update password in the correct table based on role
      if (user.role === "admin") {
        await db.updateOrgAdminPassword(user.id, passForm.newPass);
      } else {
        await db.updateWorkerPassword(user.id, passForm.newPass);
      }
      setPassForm({ current: "", newPass: "", confirm: "" });
      showToast("✅ Password changed successfully!");
    } catch (e) {
      setPassErr("Failed to change password. Try again.");
      console.error("changeMyPassword:", e);
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogo = async (e) => { const file = e.target.files[0]; if (!file) return; setF(x => ({ ...x, logo: null })); const b64 = await readFile64(file); setF(x => ({ ...x, logo: b64 })); };
  const handleQr = async (e) => { const file = e.target.files[0]; if (!file) return; const b64 = await readFile64(file); setF(x => ({ ...x, paymentQr: b64, paymentQrLocked: false })); };
  const lockQr = () => { if (!f.paymentQr) return showToast("Upload a QR code first", "error"); setF(x => ({ ...x, paymentQrLocked: true })); showToast("Payment QR is now locked permanently"); };
  const handleBgImage = async (e) => { const file = e.target.files[0]; if (!file) return; const b64 = await readFile64(file); setF(x => ({ ...x, bgImage: b64 })); showToast("Wallpaper uploaded! Save settings to apply."); };
  const save = () => { setBrand(f); showToast("Settings saved successfully"); };

  const previewBill = (() => {
    const items = [
      { desc: "Visiting Card", qty: 2, rate: 150 },
      { desc: "Pamphlet Printing", qty: 1, rate: 500 },
    ];
    const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
    const gst = true;
    const gstAmt = gst ? subtotal * 0.18 : 0;
    const total = subtotal + gstAmt;
    return {
      id: `${(f.invoicePrefix || "INV")}-0001`,
      createdAt: now(),
      customer: "Walk-in Customer",
      invoiceType: "tax",
      gst,
      items: items.map(it => ({ ...it, subtotal: (Number(it.qty) || 0) * (Number(it.rate) || 0) })),
      subtotal,
      gstAmt,
      total,
      notes: "Sample note (optional)",
    };
  })();

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
          <div style={{ marginTop: 16, padding: 14, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8, fontSize: ".85rem" }}>GST & Tax Invoice Details</div>
            <div className="form-grid">
              <div className="form-group"><label>Business State</label><input value={f.state || ""} onChange={e => setF(x => ({ ...x, state: e.target.value }))} placeholder="Rajasthan" /></div>
              <div className="form-group"><label>GST Number</label><input value={f.gstNumber || ""} onChange={e => setF(x => ({ ...x, gstNumber: e.target.value.toUpperCase() }))} placeholder="08ABCDE1234F1Z5" /></div>
              <div className="form-group"><label>PAN Number</label><input value={f.panNumber || ""} onChange={e => setF(x => ({ ...x, panNumber: e.target.value.toUpperCase() }))} placeholder="ABCDE1234F" /></div>
              <div className="form-group"><label>Authorised Signatory</label><input value={f.authorisedSignatory || ""} onChange={e => setF(x => ({ ...x, authorisedSignatory: e.target.value }))} placeholder="Authorised Signatory" /></div>
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
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">Bank Details</div>
          <div className="form-grid">
            <div className="form-group"><label>Account Name</label><input value={f.accountName || ""} onChange={e => setF(x => ({ ...x, accountName: e.target.value }))} /></div>
            <div className="form-group"><label>Bank Name</label><input value={f.bankName || ""} onChange={e => setF(x => ({ ...x, bankName: e.target.value }))} /></div>
            <div className="form-group"><label>Account Number</label><input value={f.accountNumber || ""} onChange={e => setF(x => ({ ...x, accountNumber: e.target.value }))} /></div>
            <div className="form-group"><label>IFSC Code</label><input value={f.ifscCode || ""} onChange={e => setF(x => ({ ...x, ifscCode: e.target.value.toUpperCase() }))} /></div>
            <div className="form-group full"><label>Branch</label><input value={f.branchName || ""} onChange={e => setF(x => ({ ...x, branchName: e.target.value }))} /></div>
          </div>
        </div>
        <div className="divider" />
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">🖨 Print Settings</div>
          <div style={{ fontSize: ".8rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
            Billing remains the same for everyone. Only the <strong>invoice print layout</strong> changes based on this setting.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            <div className="form-group">
              <label>Invoice Print Type</label>
              <select value={f.invoicePrintType || "default"} onChange={e => setF(x => ({ ...x, invoicePrintType: e.target.value }))}>
                <option value="default">Default Invoice (A4 / standard invoice layout)</option>
                <option value="thermal">Thermal Printer Invoice (2 inch / 3 inch)</option>
              </select>
            </div>

            {(f.invoicePrintType || "default") === "thermal" ? (
              <div className="form-grid">
                <div className="form-group">
                  <label>Thermal Paper Size</label>
                  <select value={String(f.thermalPaperMm ?? 80)} onChange={e => setF(x => ({ ...x, thermalPaperMm: Number(e.target.value) }))}>
                    <option value="58">58mm (2 inch)</option>
                    <option value="80">80mm (3 inch)</option>
                  </select>
                  <div style={{ fontSize: ".72rem", color: "var(--text3)", marginTop: 6 }}>
                    Tip: Set browser print margins to <strong>None</strong> for best results.
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: ".72rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>
                Live preview
              </div>
              {(f.invoicePrintType || "default") === "thermal"
                ? (
                  <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, overflow: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ transform: "scale(.92)", transformOrigin: "top center" }}>
                        <ThermalInvoiceSheet
                          bill={previewBill}
                          brand={f}
                          payInfo={{ paidAmount: 0, remaining: previewBill.total, status: "Unpaid", isPaid: false }}
                          paperMm={Number(f.thermalPaperMm ?? 80)}
                          isPreview
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, overflow: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ transform: "scale(.55)", transformOrigin: "top center" }}>
                        <InvoiceSheet
                          bill={previewBill}
                          brand={f}
                          payInfo={{ paidAmount: 0, remaining: previewBill.total, status: "Unpaid", isPaid: false }}
                          invLink={`${window.location.origin}/preview`}
                          invQR={qrImgUrl(`${window.location.origin}/preview`, 90)}
                          invoiceRef={a4PreviewRef}
                          showTapToPay={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
            </div>

        <div className="divider" />
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">📄 Default Billing Mode</div>
          <div style={{ fontSize: ".8rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
            Choose which interface opens when you click <strong>+ New Invoice / Create Bill</strong>.
          </div>
          <div className="form-group" style={{ maxWidth: 320 }}>
            <select value={f.defaultBillingMethod || "modern"} onChange={e => setF(x => ({ ...x, defaultBillingMethod: e.target.value }))}>
              <option value="modern">Modern (Professional full-page layout)</option>
              <option value="classic">Classic (Simple quick layout)</option>
            </select>
          </div>
        </div>
        <div className="divider" />

        {/* ── Appearance & Customization ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="set-sec-title">🎨 Appearance & Customization</div>
          <div style={{ fontSize: ".8rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 16 }}>
            Personalize your workspace with a custom wallpaper, background color, and sidebar color.
          </div>

          {/* Wallpaper Upload */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: ".78rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".04em" }}>🖼 Background Wallpaper</label>
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div
                onClick={() => bgImageRef.current.click()}
                style={{
                  width: 160, height: 100, borderRadius: 12,
                  border: f.bgImage ? "2px solid var(--accent)" : "2px dashed var(--border)",
                  background: f.bgImage ? `url('${f.bgImage}') center/cover` : "var(--surface2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", flexShrink: 0, position: "relative",
                  transition: "border-color .2s, transform .2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
                onMouseLeave={e => e.currentTarget.style.transform = ""}
              >
                {!f.bgImage && (
                  <div style={{ textAlign: "center", color: "var(--text3)", pointerEvents: "none" }}>
                    <div style={{ fontSize: 24 }}>📷</div>
                    <div style={{ fontSize: ".68rem", marginTop: 4 }}>Click to upload</div>
                  </div>
                )}
                {f.bgImage && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  >
                    <span style={{ color: "#fff", fontSize: ".72rem", fontWeight: 700 }}>Change</span>
                  </div>
                )}
              </div>
              <input ref={bgImageRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={handleBgImage} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: ".8rem", color: "var(--text2)", lineHeight: 1.7, marginBottom: 12 }}>
                  Upload any <strong>photo or image</strong> to use as your workspace wallpaper. It will appear behind all panels.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {f.bgImage && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, bgImage: null }))}>
                      ✕ Remove Wallpaper
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => bgImageRef.current.click()}>
                    <Icon name="upload" size={12} /> {f.bgImage ? "Replace" : "Upload Photo"}
                  </button>
                </div>
                {f.bgImage && (
                  <div style={{ marginTop: 12 }}>
                    <label className="toggle-wrap" style={{ gap: 10 }}>
                      <button
                        type="button"
                        className={`toggle ${f.bgBlur ? "on" : ""}`}
                        onClick={() => setF(x => ({ ...x, bgBlur: !x.bgBlur }))}
                      />
                      <span className="toggle-label">Frosted glass blur overlay</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 10, fontSize: ".78rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".04em" }}>🎨 Main Background Color</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="color"
                value={f.bgColor || "#f4f6fa"}
                onChange={e => setF(x => ({ ...x, bgColor: e.target.value }))}
                style={{ width: 52, height: 40, padding: 2, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer", background: "none" }}
              />
              <input
                type="text"
                value={f.bgColor || ""}
                onChange={e => setF(x => ({ ...x, bgColor: e.target.value }))}
                placeholder="#f4f6fa or leave blank for default"
                style={{ maxWidth: 220, fontSize: ".82rem" }}
              />
              {f.bgColor && (
                <button className="btn btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, bgColor: "" }))}>Reset</button>
              )}
            </div>
            {/* Preset colors */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { label: "Default",   color: "" },
                { label: "Slate",     color: "#e8ecf4" },
                { label: "Rose",      color: "#fff1f2" },
                { label: "Mint",      color: "#f0fdf4" },
                { label: "Sky",       color: "#f0f9ff" },
                { label: "Amber",     color: "#fffbeb" },
                { label: "Violet",    color: "#f5f3ff" },
                { label: "Dark Navy", color: "#0c1222" },
                { label: "Deep Dark", color: "#111827" },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => setF(x => ({ ...x, bgColor: p.color }))}
                  title={p.label}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: p.color || "linear-gradient(135deg,#f4f6fa,#e8ecf4)",
                    border: f.bgColor === p.color ? "2.5px solid var(--accent)" : "1.5px solid var(--border)",
                    cursor: "pointer", transition: "transform .15s, border-color .15s",
                    boxShadow: f.bgColor === p.color ? "0 0 0 3px rgba(37,99,235,.2)" : "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                  onMouseLeave={e => e.currentTarget.style.transform = ""}
                />
              ))}
            </div>
          </div>

          {/* Sidebar Color */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: "block", marginBottom: 10, fontSize: ".78rem", fontWeight: 700, color: "var(--text2)", textTransform: "uppercase", letterSpacing: ".04em" }}>🗂 Sidebar Color</label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="color"
                value={f.sidebarColor || "#0B132B"}
                onChange={e => setF(x => ({ ...x, sidebarColor: e.target.value }))}
                style={{ width: 52, height: 40, padding: 2, borderRadius: 8, border: "1.5px solid var(--border)", cursor: "pointer", background: "none" }}
              />
              <input
                type="text"
                value={f.sidebarColor || ""}
                onChange={e => setF(x => ({ ...x, sidebarColor: e.target.value }))}
                placeholder="#0B132B or leave blank for default"
                style={{ maxWidth: 220, fontSize: ".82rem" }}
              />
              {f.sidebarColor && (
                <button className="btn btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, sidebarColor: "" }))}>Reset</button>
              )}
            </div>
            {/* Sidebar preset colors */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {[
                { label: "Default Dark",  color: "#0B132B" },
                { label: "Indigo",        color: "#312e81" },
                { label: "Deep Blue",     color: "#1e3a5f" },
                { label: "Teal",          color: "#0f3d3e" },
                { label: "Emerald",       color: "#064e3b" },
                { label: "Charcoal",      color: "#1f2937" },
                { label: "Royal Purple",  color: "#4c1d95" },
                { label: "Crimson",       color: "#7f1d1d" },
                { label: "Rose Gold",     color: "#881337" },
                { label: "Coffee",        color: "#292524" },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => setF(x => ({ ...x, sidebarColor: p.color }))}
                  title={p.label}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: p.color,
                    border: f.sidebarColor === p.color ? "2.5px solid var(--accent)" : "1.5px solid var(--border)",
                    cursor: "pointer", transition: "transform .15s, border-color .15s",
                    boxShadow: f.sidebarColor === p.color ? "0 0 0 3px rgba(37,99,235,.2)" : "none",
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
                  onMouseLeave={e => e.currentTarget.style.transform = ""}
                />
              ))}
            </div>
          </div>

          {/* Live mini-preview */}
          <div style={{ marginTop: 20, borderRadius: 12, overflow: "hidden", border: "1.5px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ fontSize: ".68rem", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--text3)", padding: "8px 14px", background: "var(--surface2)" }}>Live Preview</div>
            <div style={{
              position: "relative", height: 120, overflow: "hidden",
              background: f.bgImage ? `url('${f.bgImage}') center/cover` : (f.bgColor || "var(--bg)"),
              display: "flex", alignItems: "stretch",
            }}>
              {/* Frosted overlay */}
              {f.bgImage && f.bgBlur && <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(14px)", background: "rgba(244,246,250,0.5)" }} />}
              {/* Mini sidebar */}
              <div style={{
                width: 70, background: f.sidebarColor || "#0B132B",
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "10px 0", gap: 8, zIndex: 1, flexShrink: 0,
              }}>
                <div style={{ width: 32, height: 8, background: "rgba(255,255,255,0.7)", borderRadius: 4 }} />
                {[1,2,3,4].map(i => <div key={i} style={{ width: 48, height: 5, background: i === 1 ? "#2563eb" : "rgba(255,255,255,0.2)", borderRadius: 4 }} />)}
              </div>
              {/* Mini content */}
              <div style={{ flex: 1, padding: 10, zIndex: 1 }}>
                <div style={{ width: "60%", height: 8, background: "rgba(0,0,0,0.2)", borderRadius: 4, marginBottom: 8 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[1,2,3].map(i => <div key={i} style={{ background: "rgba(255,255,255,0.65)", borderRadius: 6, height: 40, backdropFilter: f.bgBlur ? "blur(8px)" : "none" }} />)}
                </div>
              </div>
            </div>
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
function WaPreviewModal({ bill, brand, billPayments, onSend, onSkip }) {
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const payLink = `${window.location.origin}?pay=${bill.id}`;
  const payQrLink = qrImgUrl(
    brand.paymentQr ? `Pay ${fmtCur(bill.total)} to ${brand.shopName}` : invLink,
    160
  );
  const payInfo = getBillPaymentInfo(bill, billPayments || []);

  // One invoice link, one pay link (pay link shows QR only, no login)
  const waMsg = [
    `*Invoice from ${brand.shopName}*`,
    ``,
    `Hi ${bill.customer || "Customer"},`,
    ``,
    `Your invoice is ready.`,
    ``,
    `*Invoice No:* ${bill.id}`,
    `*Work:* ${bill.desc}${bill.size ? " (" + bill.size + ")" : ""}`,
    `*Qty:* ${bill.qty}  |  *Rate:* ${fmtCur(bill.rate)}`,
    bill.gst ? `*GST (18%):* ${fmtCur(bill.gstAmt)}` : null,
    `*Total:* ${fmtCur(bill.total)}`,
    payInfo.paidAmount > 0 ? `*Advance Received:* ${fmtCur(payInfo.paidAmount)}` : null,
    payInfo.paidAmount > 0 ? `*Balance Due:* ${fmtCur(payInfo.remaining)}` : null,
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
  const waMsgFormatted = buildInvoiceWhatsAppMessage({ bill, brand, billPayments: billPayments || [] });

  const openWa = () => {
    const num = bill.phone ? bill.phone.replace(/\D/g, "") : brand.whatsapp;
    const target = num.startsWith("91") || num.length >= 12 ? num : `91${num}`;
    window.open(`https://wa.me/${target}?text=${encodeURIComponent(waMsgFormatted)}`, "_blank");
    onSend();
  };

  const copyMsg = async () => {
    try {
      await navigator.clipboard.writeText(waMsgFormatted);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = waMsgFormatted;
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
          <pre style={{ fontSize: ".75rem", color: "#1b5e20", whiteSpace: "pre-wrap", fontFamily: "var(--font)", lineHeight: 1.55, maxHeight: 180, overflowY: "auto" }}>{waMsgFormatted}</pre>
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

// Normalize bill line items: support legacy single-line or multi-item
const getBillItems = (bill) => {
  if (bill.items && Array.isArray(bill.items) && bill.items.length > 0) {
    return bill.items.map(it => ({
      desc: it.nameText || it.name || it.desc || "",
      description: it.description || "",
      size: it.size || "",
      hsnSac: it.hsnSac || it.hsn_sac || "",
      unit: it.unit || "",
      qty: Number(it.qty) || 1,
      rate: Number(it.rate) || 0,
      subtotal: (Number(it.qty) || 1) * (Number(it.rate) || 0),
    }));
  }
  return [{
    desc: bill.nameText || bill.name || bill.desc || "",
    description: bill.description || "",
    size: bill.size || "",
    hsnSac: bill.hsnSac || bill.hsn_sac || "",
    unit: bill.unit || "",
    qty: Number(bill.qty) || 1,
    rate: Number(bill.rate) || 0,
    subtotal: (Number(bill.qty) || 1) * (Number(bill.rate) || 0),
  }];
};

// ── Add Payment Modal ─────────────────────────────────────────────────────────
export function AddPaymentModal({ bill, billPayments, onAdd, onClose }) {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const info = getBillPaymentInfo(bill, billPayments);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">Add Payment</div>
        <div style={{ marginBottom: 16, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: ".85rem" }}>
          <div><strong>{bill.id}</strong> · {bill.customer}</div>
          <div style={{ marginTop: 4, color: "var(--text2)" }}>Total: {fmtCur(bill.total)} · Paid: {fmtCur(info.paidAmount)} · Remaining: {fmtCur(info.remaining)}</div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Payment method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} placeholder={info.remaining} />
          </div>
          <div className="form-group full">
            <label>Notes (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Cheque #123" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onAdd(method, amount, note); }}>Record Payment</button>
        </div>
      </div>
    </div>
  );
}

// ── Billing ───────────────────────────────────────────────────────────────────
const defaultLineItem = () => ({ desc: "", size: "", qty: 1, rate: 0, productId: null, hsnSac: "", unit: "" });
const defaultDueDateStr = () => {
  try {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};
function BillingPage({ bills, setBills, billPayments, setBillPayments, showToast, customers, setCustomers, brand, setBrand, user, products }) {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState(""); const [filterDate, setFilterDate] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [invoiceView, setInvoiceView] = useState(null);
  const [waPreview, setWaPreview] = useState(null);
  const [addPaymentBill, setAddPaymentBill] = useState(null); // bill for Add Payment modal
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    email: "",
    poNumber: "",
    customerAddress: "",
    customerGstin: "",
    shipToName: "",
    shipToAddress: "",
    placeOfSupply: "",
    invoiceType: "supply",
    gst: false,
    paid: false,
    advanceAmount: "",
    advanceMethod: "cash",
    advanceNote: "",
    dueDate: defaultDueDateStr(),
    notes: "",
  });
  const [lineItems, setLineItems] = useState([defaultLineItem()]);

  const itemsWithSubtotal = lineItems.map(it => ({ ...it, subtotal: (it.qty || 0) * (it.rate || 0) }));
  const subtotal = itemsWithSubtotal.reduce((s, it) => s + it.subtotal, 0);
  const gstAmt = form.gst ? subtotal * 0.18 : 0;
  const total = subtotal + gstAmt;
  const todayStr = new Date().toISOString().slice(0, 10);

  const applyKnownCustomer = (existing) => {
    if (!existing) return;
    setForm(f => ({
      ...f,
      customer: existing.name || f.customer,
      phone: String(existing.phone || "").replace(/\D/g, "") || f.phone,
      email: existing.email || f.email || "",
      customerAddress: existing.billing_address || existing.billingAddress || existing.customerAddress || f.customerAddress || "",
      customerGstin: existing.gstin || existing.customerGstin || f.customerGstin || "",
      shipToName: existing.shipping_name || existing.shipToName || existing.name || f.shipToName || "",
      shipToAddress: existing.shipping_address || existing.shippingAddress || existing.shipToAddress || f.shipToAddress || "",
      placeOfSupply: existing.state || existing.placeOfSupply || f.placeOfSupply || brand.state || "",
    }));
  };

  // When typing a phone number, auto-fill customer name/email if we already know this customer
  const handlePhoneChange = (value) => {
    const cleaned = (value || "").replace(/\D/g, "");
    const existing = customers.find(c => (String(c.phone || "").replace(/\D/g, "")) === cleaned);
    if (existing) {
      applyKnownCustomer({ ...existing, phone: cleaned });
    } else {
      setForm(f => ({ ...f, phone: cleaned }));
    }
  };

  const handleCustomerNameChange = (value) => {
    const nextName = value || "";
    const existing = customers.find(c => (c.name || "").trim().toLowerCase() === nextName.trim().toLowerCase());
    if (existing) {
      applyKnownCustomer(existing);
      return;
    }
    setForm(f => ({ ...f, customer: nextName }));
  };

  const addLineItem = () => setLineItems(prev => [...prev, defaultLineItem()]);
  const removeLineItem = (idx) => {
    if (lineItems.length <= 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };
  const updateLineItem = (idx, field, value) => {
    setLineItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      if (field === "qty" || field === "rate") {
        return { ...it, [field]: typeof value === "number" ? value : +value || 0 };
      }
      return { ...it, [field]: value };
    }));
  };

  const [productSearch, setProductSearch] = useState({}); // idx -> search string
  const [productDropdownOpen, setProductDropdownOpen] = useState(null); // idx or null

  useEffect(() => {
    try {
      const mq = window.matchMedia("(max-width: 768px)");
      const apply = () => setIsMobile(!!mq.matches);
      apply();
      if (mq.addEventListener) mq.addEventListener("change", apply);
      else mq.addListener(apply);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", apply);
        else mq.removeListener(apply);
      };
    } catch {
      setIsMobile(false);
      return undefined;
    }
  }, []);

  const handleSelectProduct = (idx, productId) => {
    const p = products.find(pr => pr.id === productId);
    if (!p) {
      updateLineItem(idx, "productId", null);
      setProductDropdownOpen(null);
      return;
    }
    setLineItems(prev => prev.map((it, i) => i !== idx ? it : {
      ...it,
      productId,
      desc: p.name,
      size: p.size || it.size || "",
      hsnSac: p.hsn_code || p.hsnCode || it.hsnSac || "",
      unit: p.unit || it.unit || "",
      rate: p.default_rate ?? p.defaultRate ?? 0,
    }));
    setProductSearch(prev => ({ ...prev, [idx]: "" }));
    setProductDropdownOpen(null);
  };

  const handleProductSearchChange = (idx, value) => {
    setProductSearch(prev => ({ ...prev, [idx]: value }));
    setProductDropdownOpen(idx);
    if (!value.trim()) {
      updateLineItem(idx, "productId", null);
      updateLineItem(idx, "desc", "");
    }
  };

  const handleApplyCustomProduct = (idx, customName) => {
    const name = (customName || productSearch[idx] || "").trim();
    setLineItems(prev => prev.map((it, i) => i !== idx ? it : {
      ...it,
      productId: null,
      desc: name,
    }));
    setProductSearch(prev => ({ ...prev, [idx]: "" }));
    setProductDropdownOpen(null);
  };

  const closeBillModal = () => {
    setShowModal(false);
    setLineItems([defaultLineItem()]);
    setForm({ customer: "", phone: "", email: "", poNumber: "", customerAddress: "", customerGstin: "", shipToName: "", shipToAddress: "", placeOfSupply: "", invoiceType: "supply", gst: false, paid: false, advanceAmount: "", advanceMethod: "cash", advanceNote: "", dueDate: defaultDueDateStr(), notes: "" });
    setProductSearch({});
    setProductDropdownOpen(null);
  };

  const createBill = async () => {
    const validItems = lineItems.filter(it => (it.desc || "").trim());
    if (!form.customer || validItems.length === 0) return showToast("Fill customer name and at least one item description", "error");
    const id = genInvId(brand);
    const items = validItems.map(it => ({
      desc: (it.desc || "").trim(),
      size: (it.size || "").trim(),
      hsnSac: (it.hsnSac || "").trim(),
      unit: (it.unit || "").trim(),
      qty: Number(it.qty) || 1,
      rate: Number(it.rate) || 0,
      subtotal: (Number(it.qty) || 1) * (Number(it.rate) || 0),
    }));
    const first = items[0];
    const billSubtotal = items.reduce((s, it) => s + it.subtotal, 0);
    const isTaxInvoice = form.invoiceType === "tax";
    const billGst = isTaxInvoice ? billSubtotal * 0.18 : 0;
    const advanceAmount = Math.max(0, Number(form.advanceAmount) || 0);
    const safeAdvanceAmount = Math.min(advanceAmount, billSubtotal + billGst);
    const bill = {
      id,
      ...form,
      invoiceType: isTaxInvoice ? "tax" : "supply",
      poNumber: (form.poNumber || "").trim() || null,
      customerAddress: (form.customerAddress || "").trim() || null,
      customerGstin: (form.customerGstin || "").trim().toUpperCase() || null,
      shipToName: (form.shipToName || "").trim() || null,
      shipToAddress: (form.shipToAddress || "").trim() || null,
      placeOfSupply: (form.placeOfSupply || brand.state || "").trim() || null,
      gst: isTaxInvoice,
      desc: first.desc,
      size: first.size,
      qty: first.qty,
      rate: first.rate,
      items,
      subtotal: billSubtotal,
      gstAmt: billGst,
      total: billSubtotal + billGst,
      paid: safeAdvanceAmount >= (billSubtotal + billGst),
      createdAt: now(),
      dueDate: form.dueDate || null,
      notes: (form.notes || "").trim() || null,
      organisationId: user?.organisationId,
    };
    const saved = await db.addBill(bill);
    if (saved) {
      setBills(b => [saved, ...b]);
      setBrand(br => ({ ...br, invoiceCounter: br.invoiceCounter + 1 }));
    } else {
      setBills(b => [bill, ...b]);
    }
    if (safeAdvanceAmount > 0) {
      const paymentPayload = {
        billId: id,
        organisationId: user?.organisationId,
        method: form.advanceMethod || "cash",
        amount: safeAdvanceAmount,
        note: (form.advanceNote || "").trim() || "Advance received at bill creation",
      };
      const savedPayment = await db.addBillPayment(paymentPayload);
      if (savedPayment) {
        setBillPayments(prev => [savedPayment, ...prev]);
      } else {
        setBillPayments(prev => [{
          id: `local-pay-${Date.now()}`,
          billId: id,
          organisationId: user?.organisationId,
          method: paymentPayload.method,
          amount: paymentPayload.amount,
          note: paymentPayload.note,
          paidAt: now(),
        }, ...prev]);
      }
    }
    if (!customers.find(c => c.phone === form.phone)) {
      // Don't set a custom id here: in Supabase, `customers.id` is usually a UUID.
      const newCust = {
        name: form.customer,
        phone: form.phone,
        email: form.email,
        gstin: form.customerGstin || null,
        billingAddress: form.customerAddress || null,
        shippingAddress: form.shipToAddress || null,
        state: form.placeOfSupply || null,
        createdAt: now(),
        organisationId: user?.organisationId,
      };
      await db.addCustomer(newCust);
      setCustomers(c => [newCust, ...c]);
    }
    const previewBill = {
      ...(saved || bill),
      paid: safeAdvanceAmount >= (billSubtotal + billGst),
    };
    setShowModal(false);
    setForm({ customer: "", phone: "", email: "", poNumber: "", customerAddress: "", customerGstin: "", shipToName: "", shipToAddress: "", placeOfSupply: "", invoiceType: "supply", gst: false, paid: false, advanceAmount: "", advanceMethod: "cash", advanceNote: "", dueDate: defaultDueDateStr(), notes: "" });
    setLineItems([defaultLineItem()]);
    setProductSearch({});
    setProductDropdownOpen(null);
    showToast("✅ Bill created: " + id);
    setWaPreview(previewBill);

    // Auto-email invoice (customer + shop Gmail copy) without manual mailto.
    try {
      const to = (bill.email || "").trim();
      const cc = (brand.gmail || "").trim();
      if (to || cc) {
        const { sendBillEmail, sendBillWhatsApp } = await import("./supabase");
        await sendBillEmail({
          type: "invoice_created",
          bill,
          brand,
          to: to || null,
          cc: cc || null,
        });
        // Also send automatic WhatsApp message when we have a WhatsApp number.
        const waTo = (brand.whatsapp || bill.phone || "").trim();
        if (waTo) {
          await sendBillWhatsApp({
            type: "invoice_created",
            bill,
            brand,
            to: waTo,
          });
        }
      }
    } catch (e) {
      console.error("Auto invoice email/WhatsApp failed:", e?.message || e);
    }
  };

  const addPaymentToBill = async (billId, method, amount, note) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return showToast("Enter a valid amount", "error");
    const saved = await db.addBillPayment({
      billId,
      organisationId: user?.organisationId,
      method: method || "cash",
      amount: amt,
      note: note || null,
    });
    if (saved) {
      setBillPayments(prev => [saved, ...prev]);
      const bill = bills.find(b => b.id === billId);
      const info = getBillPaymentInfo(bill, [saved, ...(billPayments || [])]);
      if (info.isPaid) {
        setBills(bs => bs.map(x => x.id === billId ? { ...x, paid: true } : x));
        await db.updateBillPaid(billId, true);

        // Auto-email payment receipt when bill becomes paid & send WhatsApp.
        try {
          const b2 = bill || bills.find(x => x.id === billId);
          if (b2) {
            const to = (b2.email || "").trim();
            const cc = (brand.gmail || "").trim();
            if (to || cc) {
              const { sendBillEmail, sendBillWhatsApp } = await import("./supabase");
              await sendBillEmail({
                type: "payment_received",
                bill: { ...b2, paid: true },
                brand,
                to: to || null,
                cc: cc || null,
              });
              const waTo = (brand.whatsapp || b2.phone || "").trim();
              if (waTo) {
                await sendBillWhatsApp({
                  type: "payment_received",
                  bill: { ...b2, paid: true },
                  brand,
                  to: waTo,
                });
              }
            }
          }
        } catch (e) {
          console.error("Auto payment email/WhatsApp failed:", e?.message || e);
        }
      }
      showToast(`Payment of ${fmtCur(amt)} recorded`);
      setAddPaymentBill(null);
    }
  };
  const deleteBill = async (id) => {
    setBills(b => b.filter(x => x.id !== id));
    await db.deleteBill(id);
    showToast("Bill deleted", "error");
  };

  const filtered = bills.filter(b => {
    const q = search.toLowerCase();
    return (!q
      || (b.customer||"").toLowerCase().includes(q)
      || (b.id||"").toLowerCase().includes(q)
      || (b.desc||"").toLowerCase().includes(q)
      || (b.phone||"").includes(search)
    )
      && (!filterDate || b.createdAt.startsWith(filterDate));
  });

  useEffect(() => {
    const handler = () => {
      if (invoiceView) setInvoiceView(null);
      else if (waPreview) setWaPreview(null);
      else if (addPaymentBill) setAddPaymentBill(null);
      else if (showModal) closeBillModal();
    };
    window.addEventListener("pm-close-modal", handler);
    return () => window.removeEventListener("pm-close-modal", handler);
  }, [invoiceView, waPreview, addPaymentBill, showModal]);

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
        {isMobile && (
          <div className="mobile-list" style={{ marginBottom: 4 }}>
            {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>No bills found</div>}
            {filtered.map(b => {
              const info = getBillPaymentInfo(b, billPayments);
              const badgeClass = info.status === "Paid" ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red";
              const desc = (b.items && b.items.length > 1)
                ? `${(b.items[0]?.desc || b.desc || "").slice(0, 35)}${(b.items[0]?.desc || b.desc || "").length > 35 ? "..." : ""} (+${b.items.length - 1} more)`
                : (b.desc || "-");
              const dueOverdue = b.dueDate && !info.isPaid && b.dueDate < todayStr;
              return (
                <div key={b.id} className="mobile-bill-card">
                  <div className="mobile-bill-top">
                    <div>
                      <div className="mobile-bill-id">{b.id}</div>
                      <div className="mobile-bill-customer">{b.customer}</div>
                      <div className="mobile-bill-phone">{b.phone || "No phone"}</div>
                    </div>
                    <span className={`badge ${badgeClass}`}>
                      {info.status === "Paid" ? "Paid" : info.status === "Partially Paid" ? `${fmtCur(info.paidAmount)} / ${fmtCur(b.total)}` : "Unpaid"}
                    </span>
                  </div>
                  <div className="mobile-bill-desc">
                    {desc}
                    <div style={{ fontSize: ".74rem", color: "var(--text3)", marginTop: 4 }}>
                      {b.size || (b.items && b.items[0]?.size) || "-"}
                    </div>
                    {b.notes && <div style={{ fontSize: ".72rem", color: "var(--text3)", marginTop: 6 }}>{(b.notes || "").length > 56 ? `${(b.notes || "").slice(0, 56)}...` : b.notes}</div>}
                  </div>
                  <div className="mobile-bill-grid">
                    <div className="mobile-bill-meta">
                      <div className="mobile-bill-label">Total</div>
                      <div className="mobile-bill-value">{fmtCur(b.total)}</div>
                    </div>
                    <div className="mobile-bill-meta">
                      <div className="mobile-bill-label">Qty</div>
                      <div className="mobile-bill-value">{b.qty}</div>
                    </div>
                    <div className="mobile-bill-meta">
                      <div className="mobile-bill-label">GST</div>
                      <div className="mobile-bill-value">{b.gst ? "18%" : "None"}</div>
                    </div>
                    <div className="mobile-bill-meta">
                      <div className="mobile-bill-label">Due Date</div>
                      <div className="mobile-bill-value">
                        {b.dueDate ? fmtDate(b.dueDate) : "-"}
                        {dueOverdue && <span className="badge badge-red" style={{ marginLeft: 6, fontSize: ".58rem" }}>Overdue</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mobile-bill-actions">
                    {!info.isPaid && <button className="btn btn-sm btn-success" onClick={() => setAddPaymentBill(b)}>Add Payment</button>}
                    <button className="btn btn-sm btn-ghost" onClick={() => setInvoiceView(b)}>Invoice</button>
                    <button className="btn btn-sm btn-wa" onClick={() => shareWa(b)}>WhatsApp</button>
                    <button className="btn btn-sm btn-gmail" onClick={() => shareGmail(b)}>Email</button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteBill(b.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="table-wrap" style={{ display: isMobile ? "none" : "block" }}>
          <table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Description</th><th>Qty</th><th>Total</th><th>GST</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills found</td></tr>}
              {filtered.map(b => (
                <tr key={b.id}>
                  <td className="font-mono" style={{ fontWeight: 700, color: "var(--accent)", fontSize: ".78rem" }}>{b.id}</td>
                  <td><div style={{ fontWeight: 600 }}>{b.customer}</div><div style={{ fontSize: ".68rem", color: "var(--text3)" }}>{b.phone}</div></td>
                  <td>
                    <div style={{ fontSize: ".8rem" }}>
                      {(b.items && b.items.length > 1)
                        ? `${(b.items[0]?.desc || b.desc || "").slice(0, 35)}${(b.items[0]?.desc || b.desc || "").length > 35 ? "…" : ""} (+${b.items.length - 1} more)`
                        : (b.desc || "—")}
                    </div>
                    <div style={{ fontSize: ".68rem", color: "var(--text3)" }}>
                      {b.size || (b.items && b.items[0]?.size) || "—"}
                    </div>
                    {b.notes && (
                      <div style={{ fontSize: ".68rem", color: "var(--text3)", marginTop: 2 }}>
                        📝 {(b.notes || "").length > 40 ? `${(b.notes || "").slice(0, 40)}…` : b.notes}
                      </div>
                    )}
                  </td>
                  <td className="font-mono">{b.qty}</td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.total)}</td>
                  <td><span className={`badge ${b.gst?"badge-blue":"badge-purple"}`}>{b.gst?"18%":"None"}</span></td>
                  <td>
                    {(() => {
                      const info = getBillPaymentInfo(b, billPayments);
                      const badgeClass = info.status === "Paid" ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red";
                      return (
                        <div className="flex gap-2 items-center" style={{ flexWrap: "wrap" }}>
                          <span className={`badge ${badgeClass}`}>
                            {info.status === "Paid" ? "✓ Paid" : info.status === "Partially Paid" ? `${fmtCur(info.paidAmount)} / ${fmtCur(b.total)}` : "Unpaid"}
                          </span>
                          {!info.isPaid && (
                            <button className="btn btn-sm btn-success" onClick={() => setAddPaymentBill(b)}>Add Payment</button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize: ".72rem", color: "var(--text3)" }}>
                    {b.dueDate
                      ? (
                          <span>
                            {fmtDate(b.dueDate)}
                            {!getBillPaymentInfo(b, billPayments).isPaid && b.dueDate < todayStr && (
                              <span
                                className="badge badge-red"
                                style={{ marginLeft: 6, fontSize: ".6rem" }}
                              >
                                Overdue
                              </span>
                            )}
                          </span>
                        )
                      : "—"}
                  </td>
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
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && closeBillModal()}>
          <div className="modal">
            <div className="modal-title">Create New Bill</div>
            <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--accent-soft)", borderRadius: "var(--radius-sm)", fontSize: ".78rem", color: "var(--accent)", fontWeight: 700, fontFamily: "var(--mono)" }}>
              Auto Invoice #: {genInvId(brand)} — system generated, cannot be edited
            </div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Invoice Type</label>
                <div className="segmented">
                  <button type="button" className={`segmented-btn ${form.invoiceType === "supply" ? "active" : ""}`} onClick={() => setForm({ ...form, invoiceType: "supply", gst: false })}>Bill of Supply</button>
                  <button type="button" className={`segmented-btn ${form.invoiceType === "tax" ? "active" : ""}`} onClick={() => setForm({ ...form, invoiceType: "tax", gst: true, placeOfSupply: form.placeOfSupply || brand.state || "" })}>Tax Invoice (GST)</button>
                </div>
              </div>
              <div className="form-group">
                <label>Customer Name *</label>
                <input value={form.customer} list="billing-customer-names" onChange={e => handleCustomerNameChange(e.target.value)} />
                <datalist id="billing-customer-names">
                  {(customers || []).map(c => <option key={c.id || c.phone || c.name} value={c.name || ""} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  placeholder="10-digit mobile (WhatsApp)"
                />
                <div style={{ fontSize: ".7rem", color: "var(--text3)", marginTop: 4 }}>
                  WhatsApp will use this number when present; otherwise it will use your shop WhatsApp.
                </div>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.dueDate || ""}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              {form.invoiceType === "tax" && (
                <div className="form-group">
                  <label>P.O. Number</label>
                  <input
                    value={form.poNumber}
                    onChange={e => setForm({ ...form, poNumber: e.target.value })}
                    placeholder="Optional purchase order number"
                  />
                </div>
              )}
              <div className="form-group full">
                <label>Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="customer@email.com"
                />
              </div>
              <div className="form-group full">
                <label>Billing Address</label>
                <textarea value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })} rows={2} placeholder="Customer billing address" />
              </div>
              {form.invoiceType === "tax" && (
                <>
                  <div className="form-group"><label>Customer GSTIN</label><input value={form.customerGstin} onChange={e => setForm({ ...form, customerGstin: e.target.value.toUpperCase() })} placeholder="Optional GSTIN" /></div>
                  <div className="form-group"><label>Place of Supply</label><input value={form.placeOfSupply} onChange={e => setForm({ ...form, placeOfSupply: e.target.value })} placeholder={brand.state || "State"} /></div>
                  <div className="form-group"><label>Ship To Name</label><input value={form.shipToName} onChange={e => setForm({ ...form, shipToName: e.target.value })} placeholder="Optional ship-to name" /></div>
                  <div className="form-group"><label>Ship To Address</label><input value={form.shipToAddress} onChange={e => setForm({ ...form, shipToAddress: e.target.value })} placeholder="Optional ship-to address" /></div>
                </>
              )}
            </div>
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <div className="flex justify-between items-center mb-2">
                <label style={{ margin: 0 }}>Line items *</label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={addLineItem}><Icon name="plus" size={12} />Add row</button>
              </div>
              <div className="table-wrap">
                <table className={`bill-items-table ${form.invoiceType === "tax" ? "" : "bill-items-supply"}`}>
                  <thead><tr><th>Product / Item</th>{form.invoiceType === "tax" ? <th>HSN/SAC</th> : null}{form.invoiceType === "tax" ? <th>Unit</th> : null}<th>Size</th><th>Qty</th><th>Rate (₹)</th><th>Amount</th><th></th></tr></thead>
                  <tbody>
                    {lineItems.map((it, idx) => {
                      const q = (productSearch[idx] ?? "").toLowerCase();
                      const matchedProducts = (products || []).filter(p =>
                        p.active !== false && (p.name || "").toLowerCase().includes(q)
                      );
                      const displayVal = productDropdownOpen === idx
                        ? (productSearch[idx] ?? "")
                        : (it.productId ? (products.find(p => p.id === it.productId)?.name || it.desc) : (it.desc || ""));
                      return (
                        <tr key={idx}>
                          <td style={{ position: "relative", minWidth: 160 }}>
                            <input
                              value={displayVal}
                              onChange={e => handleProductSearchChange(idx, e.target.value)}
                              onFocus={() => {
                setProductDropdownOpen(idx);
                const cur = it.productId ? (products.find(p => p.id === it.productId)?.name || it.desc) : (it.desc || "");
                setProductSearch(prev => ({ ...prev, [idx]: cur }));
              }}
                              onBlur={() => setTimeout(() => {
                                const val = (productSearch[idx] ?? "").trim();
                                if (val && !it.productId) handleApplyCustomProduct(idx, val);
                                setProductDropdownOpen(null);
                              }, 150)}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  if (matchedProducts.length > 0) {
                                    handleSelectProduct(idx, matchedProducts[0].id);
                                  } else {
                                    handleApplyCustomProduct(idx, e.target.value);
                                  }
                                  e.preventDefault();
                                } else if (e.key === "Escape") {
                                  setProductDropdownOpen(null);
                                }
                              }}
                              placeholder="Search product or type custom name…"
                              style={{ minWidth: 0 }}
                            />
                            {productDropdownOpen === idx && (
                              <div
                                style={{
                                  position: "absolute",
                                  left: 0,
                                  top: "100%",
                                  marginTop: 2,
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-sm)",
                                  boxShadow: "var(--shadow-lg)",
                                  zIndex: 100,
                                  maxHeight: 200,
                                  overflowY: "auto",
                                  minWidth: 220,
                                }}
                              >
                                {matchedProducts.slice(0, 8).map(p => (
                                  <div
                                    key={p.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleSelectProduct(idx, p.id)}
                                    onKeyDown={e => e.key === "Enter" && handleSelectProduct(idx, p.id)}
                                    style={{
                                      padding: "8px 12px",
                                      cursor: "pointer",
                                      fontSize: ".85rem",
                                      borderBottom: "1px solid var(--border)",
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: ".72rem", color: "var(--text3)" }}>
                                      {fmtCur(p.default_rate ?? p.defaultRate ?? 0)} {p.unit ? `/ ${p.unit}` : ""} — click to apply (rate editable)
                                    </div>
                                  </div>
                                ))}
                                {(productSearch[idx] ?? "").trim() && (
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleApplyCustomProduct(idx, productSearch[idx])}
                                    onKeyDown={e => e.key === "Enter" && handleApplyCustomProduct(idx, productSearch[idx])}
                                    style={{
                                      padding: "8px 12px",
                                      cursor: "pointer",
                                      fontSize: ".85rem",
                                      background: "var(--accent-soft)",
                                      fontWeight: 600,
                                    }}
                                    className="cursor-pointer"
                                  >
                                    + Add custom: &quot;{productSearch[idx] || ""}&quot;
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          {form.invoiceType === "tax" ? <td><input value={it.hsnSac || ""} onChange={e => updateLineItem(idx, "hsnSac", e.target.value)} placeholder="9989" style={{ width: 90 }} /></td> : null}
                          {form.invoiceType === "tax" ? <td><input value={it.unit || ""} onChange={e => updateLineItem(idx, "unit", e.target.value)} placeholder="PCS" style={{ width: 70 }} /></td> : null}
                          <td><input value={it.size} onChange={e => updateLineItem(idx, "size", e.target.value)} placeholder="A4, 10x4 ft" style={{ width: 84 }} /></td>
                          <td><input type="number" min={1} value={it.qty} onChange={e => updateLineItem(idx, "qty", e.target.value)} style={{ width: 56 }} /></td>
                          <td><input type="number" min={0} step="0.01" value={it.rate} onChange={e => updateLineItem(idx, "rate", e.target.value)} placeholder="0" style={{ width: 76 }} title="Rate is always editable" /></td>
                          <td className="font-mono" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{fmtCur((it.qty || 0) * (it.rate || 0))}</td>
                          <td>
                            {lineItems.length > 1 ? <button type="button" className="btn btn-sm btn-ghost" style={{ padding: "4px 8px" }} onClick={() => removeLineItem(idx)} title="Remove row"><Icon name="trash" size={12} /></button> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="form-group full">
                <label>Internal Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Anything special about this order, delivery notes, etc. (visible on invoice)"
                />
              </div>
            </div>
            <div style={{ marginTop: 14, padding: "14px 16px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: "var(--text)" }}>Advance Received (optional)</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Advance Amount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.advanceAmount}
                    onChange={e => setForm({ ...form, advanceAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Payment Method</label>
                  <select value={form.advanceMethod} onChange={e => setForm({ ...form, advanceMethod: e.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group full">
                  <label>Advance Note</label>
                  <input
                    value={form.advanceNote}
                    onChange={e => setForm({ ...form, advanceNote: e.target.value })}
                    placeholder="Example: 50% advance received"
                  />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              <div className="toggle-wrap" onClick={() => form.invoiceType === "tax" && setForm({...form,gst:!form.gst})}><button className={`toggle ${form.gst?"on":""}`} /><span className="toggle-label">{form.invoiceType === "tax" ? `GST 18%${form.gst?` (+${fmtCur(gstAmt)})`:"" }` : "Non-GST invoice"}</span></div>
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
              <button className="btn btn-ghost" onClick={closeBillModal}>Cancel</button>
              <button className="btn btn-primary" onClick={createBill}><Icon name="billing" size={14} />Generate &amp; Send</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment modal */}
      {addPaymentBill && (
        <AddPaymentModal
          bill={addPaymentBill}
          billPayments={billPayments}
          onAdd={(method, amount, note) => addPaymentToBill(addPaymentBill.id, method, amount, note)}
          onClose={() => setAddPaymentBill(null)}
        />
      )}

      {/* WhatsApp auto-send preview */}
      {waPreview && (
        <WaPreviewModal
          bill={waPreview}
          brand={brand}
          billPayments={billPayments}
          onSend={() => { showToast("📲 Opening WhatsApp…", "success"); setWaPreview(null); }}
          onSkip={() => { showToast("WhatsApp skipped", "info"); setWaPreview(null); }}
        />
      )}

      {invoiceView && <InvoiceModal bill={invoiceView} brand={brand} billPayments={billPayments} onClose={() => setInvoiceView(null)} />}
    </div>
  );
}

// ── Professional Invoice Modal ─────────────────────────────────────────────────
function InvoiceSheet({ bill, brand, payInfo, invLink, invQR, invoiceRef, showTapToPay = false }) {
  const items = getBillItems(bill);
  const isTaxInvoice = (bill.invoiceType || (bill.gst ? "tax" : "supply")) === "tax";
  const subTotal = Number(bill.subtotal || 0);
  const gstTotal = isTaxInvoice ? Number(bill.gstAmt || 0) : 0;
  const cgst = gstTotal / 2;
  const sgst = gstTotal / 2;
  const taxRate = isTaxInvoice ? 9 : 0;
  const grandTotal = Number(bill.total || 0);
  const words = amountToWords(grandTotal);
  const payableAmount = Math.max(Number(payInfo?.remaining ?? grandTotal) || 0, 0);
  const sellerName = brand.accountName || brand.shopName;
  const billToName = bill.customer || "Walk-in Customer";
  const shipToName = bill.shipToName || bill.customer || "Same as Bill To";
  const shipToAddress = bill.shipToAddress || bill.customerAddress || "Same as Bill To";
  const visiblePayments = Number(payInfo?.paidAmount || 0) > 0;
  const taxSummary = isTaxInvoice
    ? items.reduce((acc, item) => {
        const key = item.hsnSac || "N/A";
        const taxableValue = Number(item.subtotal || (Number(item.qty || 0) * Number(item.rate || 0)) || 0);
        if (!acc[key]) acc[key] = { hsnSac: key, taxableValue: 0 };
        acc[key].taxableValue += taxableValue;
        return acc;
      }, {})
    : {};

  return (
    <div className="inv-wrap" ref={invoiceRef} style={{ maxWidth: 900, width: "100%", margin: "0 auto", padding: 24, borderRadius: 0, boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: ".86rem", fontWeight: 800, letterSpacing: ".03em", color: "#111827" }}>
          {bill.docType ? bill.docType.toUpperCase() : (isTaxInvoice ? "TAX INVOICE" : "BILL OF SUPPLY")}
        </div>
        <div style={{ border: "1px solid #94a3b8", padding: "4px 8px", fontSize: ".68rem", fontWeight: 700, color: "#475569" }}>
          {bill.docType === "Payment In" ? "PAYMENT RECEIPT" : "ORIGINAL FOR RECIPIENT"}
        </div>
      </div>

      <div style={{ border: "1px solid #111827", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr" }}>
          <div style={{ padding: 12, borderRight: "1px solid #111827" }}>
            <div style={{ fontSize: "1.08rem", fontWeight: 900, color: "#3b4cca", textTransform: "uppercase", marginBottom: 6 }}>
              {brand.shopName}
            </div>
            <div style={{ fontSize: ".72rem", lineHeight: 1.5, color: "#111827" }}>
              {brand.address || "Address not set"}
              <br />
              {brand.gstNumber ? <>GSTIN: {brand.gstNumber}<br /></> : null}
              {brand.phone ? <>Mobile: {brand.phone}<br /></> : null}
              {brand.panNumber ? <>PAN Number: {brand.panNumber}<br /></> : null}
              {brand.gmail ? <>Email: {brand.gmail}<br /></> : null}
              {brand.state ? <>State: {brand.state}</> : null}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", fontSize: ".72rem", color: "#111827" }}>
            <div style={{ padding: 10, borderRight: "1px solid #111827", borderBottom: "1px solid #111827" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Invoice No.</div>
              <div>{bill.id}</div>
            </div>
            <div style={{ padding: 10, borderBottom: "1px solid #111827" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Invoice Date</div>
              <div>{fmtDate(bill.createdAt)}</div>
            </div>
            <div style={{ padding: 10, borderRight: "1px solid #111827" }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>P.O. No.</div>
              <div>{bill.poNumber || "-"}</div>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Due Date</div>
              <div>{bill.dueDate ? fmtDate(bill.dueDate) : "-"}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #111827" }}>
          <div style={{ padding: 12, borderRight: "1px solid #111827", minHeight: 108 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, marginBottom: 6 }}>BILL TO</div>
            <div style={{ fontSize: ".75rem", lineHeight: 1.5 }}>
              <strong>{billToName}</strong><br />
              {bill.customerAddress || "Address not provided"}<br />
              {bill.phone ? <>Mobile: {bill.phone}<br /></> : null}
              {isTaxInvoice ? <>GSTIN: {bill.customerGstin || "-"}<br /></> : null}
              {isTaxInvoice ? <>Place of Supply: {bill.placeOfSupply || brand.state || "-"}</> : null}
            </div>
          </div>
          <div style={{ padding: 12, minHeight: 108 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 800, marginBottom: 6 }}>SHIP TO</div>
            <div style={{ fontSize: ".75rem", lineHeight: 1.5 }}>
              <strong>{shipToName}</strong><br />
              {shipToAddress}
            </div>
          </div>
        </div>
      </div>

      <table className="inv-table" style={{ border: "1px solid #111827", marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={{ width: 48, textAlign: "center" }}>S.No.</th>
            <th>Items / Services</th>
            {isTaxInvoice ? <th style={{ width: 88, textAlign: "center" }}>HSN/SAC</th> : null}
            <th style={{ width: 74, textAlign: "center" }}>Qty.</th>
            <th style={{ width: 88, textAlign: "right" }}>Rate</th>
            <th style={{ width: 104, textAlign: "right" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ textAlign: "center" }}>{index + 1}</td>
              <td>
                <div style={{ fontWeight: 700 }}>{item.desc || "-"}</div>
                {(item.description && item.description !== item.desc) ? <div style={{ color: "#475569", fontSize: ".75rem", marginTop: 2, whiteSpace: "pre-wrap" }}>{item.description}</div> : null}
                {(item.size || item.unit) ? <div style={{ color: "#64748b", fontSize: ".7rem", marginTop: 2 }}>{[item.size, item.unit].filter(Boolean).join(" • ")}</div> : null}
              </td>
              {isTaxInvoice ? <td style={{ textAlign: "center" }}>{item.hsnSac || "-"}</td> : null}
              <td style={{ textAlign: "center" }}>{`${item.qty || 0} ${item.unit || ""}`.trim()}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{Number(item.rate || 0).toFixed(2)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{Number(item.subtotal || 0).toFixed(2)}</td>
            </tr>
          ))}
          {isTaxInvoice ? (
            <>
              <tr>
                <td colSpan="4" />
                <td style={{ textAlign: "right", fontStyle: "italic", fontWeight: 700 }}>CGST @{taxRate}%</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan="4" />
                <td style={{ textAlign: "right", fontStyle: "italic", fontWeight: 700 }}>SGST @{taxRate}%</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{sgst.toFixed(2)}</td>
              </tr>
            </>
          ) : null}
          <tr>
            <td colSpan={isTaxInvoice ? 4 : 3} />
            <td style={{ textAlign: "right", fontWeight: 800 }}>TOTAL</td>
            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 900 }}>{grandTotal.toFixed(2)}</td>
          </tr>
          {visiblePayments ? (
            <tr>
              <td colSpan={isTaxInvoice ? 4 : 3} />
              <td style={{ textAlign: "right", fontWeight: 700, color: "#047857" }}>Advance Received</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#047857" }}>
                {Number(payInfo.paidAmount || 0).toFixed(2)}
              </td>
            </tr>
          ) : null}
          {visiblePayments ? (
            <tr>
              <td colSpan={isTaxInvoice ? 4 : 3} />
              <td style={{ textAlign: "right", fontWeight: 800 }}>Balance Due</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 900 }}>
                {payableAmount.toFixed(2)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {isTaxInvoice ? (
        <table className="inv-table" style={{ border: "1px solid #111827", borderTop: "none", marginBottom: 0 }}>
          <thead>
            <tr>
              <th>HSN/SAC</th>
              <th style={{ textAlign: "right" }}>Taxable Value</th>
              <th style={{ textAlign: "center" }}>CGST Rate</th>
              <th style={{ textAlign: "right" }}>CGST Amount</th>
              <th style={{ textAlign: "center" }}>SGST Rate</th>
              <th style={{ textAlign: "right" }}>SGST Amount</th>
              <th style={{ textAlign: "right" }}>Total Tax Amount</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(taxSummary).map((row) => {
              const taxableValue = Number(row.taxableValue || 0);
              const perSide = taxableValue * (taxRate / 100);
              return (
                <tr key={row.hsnSac}>
                  <td>{row.hsnSac}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{taxableValue.toFixed(2)}</td>
                  <td style={{ textAlign: "center" }}>{taxRate}%</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{perSide.toFixed(2)}</td>
                  <td style={{ textAlign: "center" }}>{taxRate}%</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{perSide.toFixed(2)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{(perSide * 2).toFixed(2)}</td>
                </tr>
              );
            })}
            <tr>
              <td style={{ fontWeight: 800 }}>Total</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{subTotal.toFixed(2)}</td>
              <td />
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{cgst.toFixed(2)}</td>
              <td />
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>{sgst.toFixed(2)}</td>
              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 900 }}>{gstTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      ) : null}

      <div style={{ border: "1px solid #111827", borderTop: "none", padding: "10px 12px", fontSize: ".74rem", lineHeight: 1.6, color: "#111827" }}>
        <strong>Total Amount (in words)</strong>
        <div>{words} Only</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr .85fr", border: "1px solid #111827", borderTop: "none", minHeight: 168 }}>
        <div style={{ padding: 12, borderRight: "1px solid #111827", fontSize: ".73rem", lineHeight: 1.7 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Bank Details</div>
          <div>Name: {sellerName || "-"}</div>
          <div>Bank: {brand.bankName || "-"}</div>
          <div>A/C No: {brand.accountNumber || "-"}</div>
          <div>IFSC Code: {brand.ifscCode || "-"}</div>
          <div>Branch: {brand.branchName || "-"}</div>
          {bill.notes ? (
            <>
              <div style={{ fontWeight: 800, marginTop: 10 }}>Notes</div>
              <div>{bill.notes}</div>
            </>
          ) : null}
          {visiblePayments ? (
            <>
              <div style={{ fontWeight: 800, marginTop: 10 }}>Payment Summary</div>
              <div>Received: {fmtCur(payInfo.paidAmount)}</div>
              <div>Balance: {fmtCur(payInfo.remaining)}</div>
            </>
          ) : null}
        </div>
        <div style={{ padding: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <div style={{ textAlign: "center" }}>
              <img src={invQR} alt="invoice-qr" width={84} height={84} style={{ border: "1px solid #cbd5e1", borderRadius: 6 }} onError={e => e.target.style.display = "none"} />
              <div style={{ fontSize: ".63rem", color: "#64748b", marginTop: 4 }}>Invoice QR</div>
            </div>
            {payableAmount > 0 && ((brand.upiId && brand.upiId.trim()) || brand.paymentQr) ? (
              <div style={{ textAlign: "center" }}>
                <img
                  src={brand.upiId && brand.upiId.trim()
                    ? qrImgUrl(upiIntentUrl(payableAmount, brand.upiId, brand.shopName), 84)
                    : (brand.paymentQr && typeof brand.paymentQr === "string" && brand.paymentQr.startsWith("/") ? `${window.location.origin}${brand.paymentQr}` : brand.paymentQr)}
                  alt="payment-qr"
                  width={84}
                  height={84}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 6 }}
                  onError={e => e.target.style.display = "none"}
                />
                <div style={{ fontSize: ".63rem", color: "#64748b", marginTop: 4 }}>Payment QR {fmtCur(payableAmount)}</div>
              </div>
            ) : null}
          </div>
          <div style={{ textAlign: "right", fontSize: ".72rem", lineHeight: 1.6 }}>
            <div>Authorised Signatory For</div>
            <div style={{ minHeight: 54 }} />
            <div style={{ fontWeight: 800, textTransform: "uppercase" }}>{brand.authorisedSignatory || brand.shopName}</div>
          </div>
        </div>
      </div>

      {showTapToPay && payableAmount > 0 && (brand.upiId && brand.upiId.trim()) ? (
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <a href={`${window.location.origin}?pay=${bill.id}`} style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
            <button type="button" style={{ padding: "12px 24px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, fontSize: ".9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,.3)" }}>
              Tap to Pay {fmtCur(payableAmount)}
            </button>
          </a>
        </div>
      ) : null}

      <div style={{ marginTop: 10, textAlign: "center", fontSize: ".62rem", color: "#64748b" }}>
        View online: {invLink}
      </div>
    </div>
  );
}

function ThermalInvoiceSheet({ bill, brand, payInfo, paperMm = 80, invoiceRef, isPreview = false }) {
  const items = getBillItems(bill);
  const subTotal = Number(bill.subtotal ?? items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.rate || 0)), 0)) || 0;
  const gstAmt = Number(bill.gstAmt || 0) || 0;
  const hasGst = !!(bill.gst || gstAmt > 0);
  const discountAmt = Number(bill.discountAmt ?? bill.discount ?? 0) || 0;
  const total = Number(bill.total ?? (subTotal + gstAmt - discountAmt)) || 0;
  const paidAmount = Number(payInfo?.paidAmount || 0) || 0;
  const balance = Number(payInfo?.remaining ?? Math.max(0, total - paidAmount)) || 0;

  const w = Number(paperMm) === 58 ? 58 : 80;
  const mono = `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  const line = (left, right, bold = false) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: bold ? 800 : 500 }}>
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{left}</span>
      <span style={{ whiteSpace: "nowrap", fontFamily: mono }}>{right}</span>
    </div>
  );

  return (
    <div
      ref={invoiceRef}
      data-print-type="thermal"
      data-paper-mm={w}
      style={{
        width: `${w}mm`,
        maxWidth: `${w}mm`,
        padding: isPreview ? "8px" : "6px",
        background: "#fff",
        color: "#000",
        fontFamily: mono,
        fontSize: w === 58 ? 10.5 : 11.5,
        lineHeight: 1.25,
        boxShadow: isPreview ? "0 12px 30px rgba(15, 23, 42, 0.10)" : "none",
        border: isPreview ? "1px solid rgba(15,23,42,.08)" : "none",
      }}
    >
      <div style={{ textAlign: "center", fontWeight: 900, fontSize: w === 58 ? 12 : 13.5, letterSpacing: ".02em" }}>
        {brand.shopName || "Business Name"}
      </div>
      {brand.address ? (
        <div style={{ textAlign: "center", marginTop: 2, whiteSpace: "pre-wrap" }}>{brand.address}</div>
      ) : null}
      {brand.phone ? <div style={{ textAlign: "center", marginTop: 2 }}>Phone: {brand.phone}</div> : null}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {line("Invoice No", bill.id || "-", true)}
      {line("Date", fmtDate(bill.createdAt) || "-", false)}
      {line("Customer", bill.customer || "Walk-in Customer", false)}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 56px 62px", gap: 6, fontWeight: 800, marginBottom: 6 }}>
        <div>Item</div>
        <div style={{ textAlign: "right" }}>Qty</div>
        <div style={{ textAlign: "right" }}>Price</div>
        <div style={{ textAlign: "right" }}>Amount</div>
      </div>

      <div style={{ borderTop: "1px solid #000", marginBottom: 6 }} />

      {items.map((it, idx) => {
        const qty = Number(it.qty || 0) || 0;
        const rate = Number(it.rate || 0) || 0;
        const amt = Number(it.subtotal ?? (qty * rate)) || 0;
        return (
          <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 40px 56px 62px", gap: 6, marginBottom: 6 }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{it.desc || "-"}</div>
              {(it.size || it.unit) ? (
                <div style={{ opacity: 0.85, fontSize: w === 58 ? 9.5 : 10.5 }}>
                  {[it.size, it.unit].filter(Boolean).join(" • ")}
                </div>
              ) : null}
            </div>
            <div style={{ textAlign: "right" }}>{qty || "-"}</div>
            <div style={{ textAlign: "right" }}>{rate ? rate.toFixed(2) : "-"}</div>
            <div style={{ textAlign: "right", fontWeight: 800 }}>{amt.toFixed(2)}</div>
          </div>
        );
      })}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {line("Subtotal", subTotal.toFixed(2), true)}
      {hasGst ? line("GST", gstAmt.toFixed(2), false) : null}
      {discountAmt > 0 ? line("Discount", `-${discountAmt.toFixed(2)}`, false) : null}
      {line("Total Amount", total.toFixed(2), true)}
      {line("Paid Amount", paidAmount.toFixed(2), false)}
      {line("Balance Amount", balance.toFixed(2), true)}

      <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

      {bill.notes ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>Notes</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{bill.notes}</div>
        </div>
      ) : null}

      {bill.terms ? (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>Terms &amp; Conditions</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{bill.terms}</div>
        </div>
      ) : null}

      <div style={{ textAlign: "center", marginTop: 6, fontWeight: 800 }}>Thank you for your purchase</div>
    </div>
  );
}

function LegacyInvoiceModal({ bill, brand, billPayments, onClose }) {
  const payInfo = getBillPaymentInfo(bill, billPayments || []);
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);
  const invRef = useRef(null);
  const items = getBillItems(bill);
  const isTaxInvoice = (bill.invoiceType || (bill.gst ? "tax" : "supply")) === "tax";
  const taxRate = isTaxInvoice ? 9 : 0;
  const cgst = isTaxInvoice ? Number(bill.gstAmt || 0) / 2 : 0;
  const sgst = isTaxInvoice ? Number(bill.gstAmt || 0) / 2 : 0;
  const words = amountToWords(bill.total);

  const handleWa = () => {
    const msg = buildInvoiceWhatsAppMessage({ bill, brand, billPayments });
    window.open(`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const handleGmail = () => {
    const sub = `Invoice from ${brand.shopName} — ${bill.id}`;
    const body = `Dear ${bill.customer},\n\nYour invoice ${bill.id} of ${fmtCur(bill.total)} from ${brand.shopName} is ready.\n\nView online: ${invLink}\n\nThank you!\n\n${brand.shopName}\n${brand.phone}\n${brand.address}`;
    window.open(`mailto:${bill.email||""}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, "_blank");
  };
  const handlePrint = () => {
    if (invRef.current) printInvoiceElement(invRef.current);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>

        {/* Action bar */}
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><Icon name="x" size={13} />Close</button>
          <button className="btn btn-sm btn-wa" onClick={handleWa}><Icon name="whatsapp" size={13} />WhatsApp</button>
          <button className="btn btn-sm btn-gmail" onClick={handleGmail}><Icon name="mail" size={13} />Gmail</button>
          <button className="btn btn-sm btn-primary" onClick={handlePrint}><Icon name="download" size={13} />Print / PDF</button>
        </div>

        {/* ── Invoice Layout ── */}
        <div className="inv-wrap" ref={invRef}>

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
                {bill.dueDate && <>Due: {fmtDate(bill.dueDate)}<br /></>}
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
              <div className="inv-lbl">Description</div>
              <div className="inv-val">{bill.desc}</div>
            </div>
            <div className="inv-bill-box">
              <div className="inv-lbl">Size</div>
              <div className="inv-val">{bill.size || "—"}</div>
            </div>
            <div className="inv-bill-box">
              <div className="inv-lbl">Payment Status</div>
              <div>
                <span className={`inv-status ${payInfo.isPaid ? "inv-paid" : payInfo.status === "Partially Paid" ? "inv-partial" : "inv-unpaid"}`}>
                  {payInfo.status === "Paid" ? "✓ PAID" : payInfo.status === "Partially Paid" ? "⏳ PARTIALLY PAID" : "⚠ UNPAID"}
                </span>
                {payInfo.paidAmount > 0 && <div style={{ fontSize: ".7rem", marginTop: 4 }}>Paid: {fmtCur(payInfo.paidAmount)} · Remaining: {fmtCur(payInfo.remaining)}</div>}
              </div>
            </div>
          </div>

          {/* Items table */}
          <table className="inv-table">
            <thead>
              <tr><th>#</th><th>Item / Description</th><th>Size</th><th style={{ textAlign:"right" }}>Qty</th><th style={{ textAlign:"right" }}>Rate</th><th style={{ textAlign:"right" }}>Amount</th></tr>
            </thead>
            <tbody>
              {getBillItems(bill).map((it, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.desc || "—"}</td>
                  <td>{it.size || "—"}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace" }}>{it.qty}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace" }}>{fmtCur(it.rate)}</td>
                  <td style={{ textAlign:"right", fontFamily:"monospace", fontWeight:700 }}>{fmtCur(it.subtotal)}</td>
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
          {(brand.upiId && brand.upiId.trim()) && (
            <div style={{ marginTop: 12, textAlign: "center" }}>
              <a href={`${window.location.origin}?pay=${bill.id}`} style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer">
                <button type="button" style={{ padding: "12px 24px", background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 10, fontSize: ".9rem", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(16,185,129,.3)" }}>
                  📱 Tap to Pay {fmtCur(bill.total)}
                </button>
              </a>
              <div style={{ fontSize: ".65rem", color: "#9ca3af", marginTop: 6 }}>Opens secure payment page</div>
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
function InvoiceModal({ bill, brand, billPayments, onClose }) {
  const payInfo = getBillPaymentInfo(bill, billPayments || []);
  const invLink = `${window.location.origin}?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);
  const invRef = useRef(null);
  const printType = (brand.invoicePrintType || "default").toLowerCase();
  const paperMm = Number(brand.thermalPaperMm || 80) || 80;

  const handleWa = () => {
    const msg = `Dear ${bill.customer}, your invoice of ${fmtCur(bill.total)} is ready from ${brand.shopName}. Please check below.\n${invLink}`;
    window.open(`https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };
  const handleGmail = () => {
    const sub = `Invoice from ${brand.shopName} - ${bill.id}`;
    const body = `Dear ${bill.customer},\n\nYour invoice ${bill.id} of ${fmtCur(bill.total)} from ${brand.shopName} is ready.\n\nView online: ${invLink}\n\nThank you!\n\n${brand.shopName}\n${brand.phone}\n${brand.address}`;
    window.open(`mailto:${bill.email || ""}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`, "_blank");
  };
  const handlePrint = () => {
    if (invRef.current) printInvoiceElement(invRef.current);
  };
  const handleDownload = () => {
    if (invRef.current) downloadInvoiceElement(invRef.current, `${bill.id || "invoice"}.pdf`);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 980 }}>
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><Icon name="x" size={13} />Close</button>
          <button className="btn btn-sm btn-wa" onClick={handleWa}><Icon name="whatsapp" size={13} />WhatsApp</button>
          <button className="btn btn-sm btn-gmail" onClick={handleGmail}><Icon name="mail" size={13} />Gmail</button>
          <button className="btn btn-sm btn-ghost" onClick={handleDownload}><Icon name="download" size={13} />Download Invoice</button>
          <button className="btn btn-sm btn-primary" onClick={handlePrint}><Icon name="download" size={13} />Print / PDF</button>
        </div>

        {printType === "thermal" ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ThermalInvoiceSheet bill={bill} brand={brand} payInfo={payInfo} paperMm={paperMm} invoiceRef={invRef} />
          </div>
        ) : (
          <InvoiceSheet
            bill={bill}
            brand={brand}
            payInfo={payInfo}
            invLink={invLink}
            invQR={invQR}
            invoiceRef={invRef}
            showTapToPay
          />
        )}
      </div>
    </div>
  );
}

function PayQRPage({ invId }) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [billPayments, setBillPayments] = useState([]);

  useEffect(() => {
    async function load() {
      const [b, br, payments] = await Promise.all([
        typeof db.getBillById === "function" ? db.getBillById(invId) : null,
        db.loadBrand(DEFAULT_BRAND),
        typeof db.getPaymentsForBill === "function" ? db.getPaymentsForBill(invId) : [],
      ]);
      if (b) setBill(b);
      if (br) setBrandLocal(br);
      setBillPayments(payments || []);
      setLoading(false);
    }
    load();
  }, [invId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #ecfdf5, #f8fafc)", padding: 16 }}>
        <AppLoader
          compact
          icon="payment"
          title="Preparing payment page..."
          subtitle="Fetching invoice details and secure UPI payment information."
        />
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

  const payInfo = getBillPaymentInfo(bill, billPayments);
  const amount = Math.max(Number(payInfo?.remaining ?? bill.total ?? 0) || 0, 0);
  const hasUpi = brand.upiId && brand.upiId.trim();
  const qrData = hasUpi ? upiIntentUrl(amount, brand.upiId, brand.shopName, `Invoice ${bill.id}`, bill.id) : null;
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
        {Number(payInfo?.paidAmount || 0) > 0 && (
          <div style={{ fontSize: ".8rem", color: "var(--text2)", marginTop: -6, marginBottom: 16 }}>
            Received {fmtCur(payInfo.paidAmount)} · Balance {fmtCur(amount)}
          </div>
        )}
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
        {hasUpi && amount > 0 && (
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
function LegacyPublicInvoicePage({ invId }) {
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #eff6ff, #f8fafc)", padding: 16 }}>
        <AppLoader
          compact
          icon="billing"
          title="Loading invoice..."
          subtitle="Please wait while we fetch your bill and prepare the printable view."
        />
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
            <div className="inv-lbl">Description</div>
            <div className="inv-val">{bill.desc}</div>
          </div>
          <div className="inv-bill-box">
            <div className="inv-lbl">Size</div>
            <div className="inv-val">{bill.size || "—"}</div>
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
            {getBillItems(bill).map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.desc || "—"}</td>
                <td>{it.size || "—"}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{it.qty}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmtCur(it.rate)}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmtCur(it.subtotal)}</td>
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

        {/* Footer: thank you + QR codes */}
        <div className="inv-footer">
          <div>
            <div style={{ fontStyle: "italic", fontSize: ".72rem", color: "#9ca3af" }}>Thank you for your business!</div>
            <div style={{ fontWeight: 700, color: "#4f67ff", marginTop: 4 }}>{brand.shopName}</div>
            <div style={{ fontSize: ".7rem", color: "#9ca3af" }}>{brand.phone}</div>
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

        <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #e4e8f0", fontSize: ".62rem", color: "#9ca3af", textAlign: "center" }}>
          This is a computer-generated invoice. No signature required. &nbsp;|&nbsp; {brand.shopName} &nbsp;|&nbsp; {brand.phone}
        </div>
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────
function PublicInvoicePage({ invId }) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [billPayments, setBillPayments] = useState([]);
  const invRef = useRef(null);
  const printType = (brand.invoicePrintType || "default").toLowerCase();
  const paperMm = Number(brand.thermalPaperMm || 80) || 80;

  useEffect(() => {
    async function load() {
      const [b, br, payments] = await Promise.all([
        typeof db.getBillById === "function" ? db.getBillById(invId) : null,
        db.loadBrand(DEFAULT_BRAND),
        typeof db.getPaymentsForBill === "function" ? db.getPaymentsForBill(invId) : [],
      ]);
      if (b) setBill(b);
      if (br) setBrandLocal(br);
      if (payments) setBillPayments(payments);
      setLoading(false);
    }
    load();
  }, [invId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg, #eff6ff, #f8fafc)", padding: 16 }}>
        <AppLoader
          compact
          icon="billing"
          title="Loading invoice..."
          subtitle="Please wait while we fetch your bill and prepare the printable view."
        />
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

  const invLink = `https://www.shiromani.xyz?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);
  const payInfo = getBillPaymentInfo(bill, billPayments);
  const handleDownload = () => {
    if (invRef.current) downloadInvoiceElement(invRef.current, `${bill.id || "invoice"}.pdf`);
  };
  const handlePrint = () => {
    if (invRef.current) printInvoiceElement(invRef.current);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#e5e7eb", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 980 }}>
        <div className="no-print" style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-sm btn-ghost" onClick={handleDownload}><Icon name="download" size={13} />Download Invoice</button>
          <button className="btn btn-sm btn-primary" onClick={handlePrint}><Icon name="download" size={13} />Print / PDF</button>
        </div>
        {printType === "thermal" ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ThermalInvoiceSheet bill={bill} brand={brand} payInfo={payInfo} paperMm={paperMm} invoiceRef={invRef} />
          </div>
        ) : (
          <InvoiceSheet
            bill={bill}
            brand={brand}
            payInfo={payInfo}
            invLink={invLink}
            invQR={invQR}
            invoiceRef={invRef}
          />
        )}
      </div>
    </div>
  );
}

// ── Invoice Details Inline View ────────────────────────────────────────────────────────
export function InvoiceDetailsView({ invId, onClose, onPaymentSaved }) {
  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState(null);
  const [brand, setBrandLocal] = useState(DEFAULT_BRAND);
  const [billPayments, setBillPayments] = useState([]);
  const invRef = useRef(null);
  const printType = (brand.invoicePrintType || "default").toLowerCase();
  const paperMm = Number(brand.thermalPaperMm || 80) || 80;

  // For inline payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");

  const load = async () => {
    setLoading(true);
    const [b, br, payments] = await Promise.all([
      typeof db.getBillById === "function" ? db.getBillById(invId) : null,
      db.loadBrand(DEFAULT_BRAND),
      typeof db.getPaymentsForBill === "function" ? db.getPaymentsForBill(invId) : [],
    ]);
    if (b) setBill(b);
    if (br) setBrandLocal(br);
    if (payments) setBillPayments(payments);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [invId]);

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AppLoader compact icon="billing" title="Loading invoice details..." />
      </div>
    );
  }

  if (!bill) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ padding: 24, textAlign: "center" }}>Invoice not found</div>
      </div>
    );
  }

  const invLink = `https://www.shiromani.xyz?inv=${bill.id}`;
  const invQR = qrImgUrl(invLink, 90);
  const payInfo = getBillPaymentInfo(bill, billPayments);

  const handleDownload = () => { if (invRef.current) downloadInvoiceElement(invRef.current, `${bill.id || "invoice"}.pdf`); };
  const handlePrint = () => { if (invRef.current) printInvoiceElement(invRef.current); };

  const handleSavePayment = async () => {
      if(!amountReceived || Number(amountReceived) <= 0) return;
      const saved = await db.addBillPayment({
          billId: bill.id,
          amount: Number(amountReceived),
          method: paymentMode || "cash",
          note: null,
          organisationId: bill.organisation_id,
      });
      playSuccessSound();
      setShowPaymentModal(false);
      setAmountReceived("");
      // Update local state immediately
      if (saved) setBillPayments(prev => [saved, ...prev]);
      // Notify App-level state so Sales list + Dashboard update too
      if (saved && typeof onPaymentSaved === 'function') onPaymentSaved(saved);
      load();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${bill.docType || "Invoice"} ${bill.id}`,
          text: `Please find your ${bill.docType || "invoice"} ${bill.id} from ${brand.shopName}.`,
          url: invLink,
        });
      } else {
        await navigator.clipboard.writeText(invLink);
        alert("Invoice link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  return (
    <div style={{ padding: "0 24px", minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #e5e7eb" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", display:"flex", alignItems:"center", padding:8 }}>
          <Icon name="back" size={20} />
        </button>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>
          {bill.docType || "Sales Invoice"} #{bill.id}
        </span>
        <span style={{ 
            padding: "4px 8px", borderRadius: "12px", fontSize: "12px", fontWeight: "600",
            background: payInfo.isPaid ? "#d1fae5" : payInfo.paidAmount > 0 ? "#fef3c7" : "#fee2e2",
            color: payInfo.isPaid ? "#065f46" : payInfo.paidAmount > 0 ? "#92400e" : "#991b1b"
        }}>
          {payInfo.isPaid ? "Paid" : payInfo.paidAmount > 0 ? "Partially Paid" : "Unpaid"}
        </span>
      </div>

      {/* Top Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", background: "white", padding: 16, borderRadius: 8, marginBottom: 24, flexWrap: "wrap", gap: 12, border: "1px solid #e5e7eb" }}>
         <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-sm" style={{ background:"white", border:"1px solid #d1d5db", color:"#374151" }} onClick={handleDownload}><Icon name="download" size={14}/> Download PDF</button>
            <button className="btn btn-sm" style={{ background:"white", border:"1px solid #d1d5db", color:"#374151" }} onClick={handlePrint}><Icon name="download" size={14}/> Print PDF</button>
            <button className="btn btn-sm" style={{ background:"white", border:"1px solid #d1d5db", color:"#374151" }} onClick={handleShare}><Icon name="share" size={14}/> Share</button>
         </div>
         <div style={{ display: "flex", gap: 12 }}>
            <button className="btn btn-sm" style={{ background:"#eff6ff", color:"#1d4ed8", border:"none", fontWeight: 600 }}>Generate e-Way bill</button>
            <button className="btn btn-sm" style={{ background:"#eff6ff", color:"#1d4ed8", border:"none", fontWeight: 600 }}>Generate e-Invoice</button>
            <button className="btn btn-sm" style={{ background:"#4f46e5", color:"white", border:"none", fontWeight: 600 }} onClick={() => setShowPaymentModal(true)}>Record Payment In</button>
         </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
         {/* LEFT: INVOICE PREVIEW */}
         <div style={{ background: "#f3f4f6", borderRadius: 8, padding: 24, overflowX: "auto", border: "1px solid #e5e7eb" }}>
            <div style={{ width: "100%", maxWidth: 880, margin: "0 auto" }}>
              {printType === "thermal" ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <ThermalInvoiceSheet bill={bill} brand={brand} payInfo={payInfo} paperMm={paperMm} invoiceRef={invRef} />
                </div>
              ) : (
                <InvoiceSheet bill={bill} brand={brand} payInfo={payInfo} invLink={invLink} invQR={invQR} invoiceRef={invRef} />
              )}
            </div>
         </div>

         {/* RIGHT: PAYMENT HISTORY CARD */}
         <div>
            <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", position:"sticky", top:24 }}>
               <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Payment History</h3>
               </div>
               <div style={{ padding: 16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, fontSize:13 }}>
                     <span style={{ color:"#6b7280" }}>Invoice Amount</span>
                     <span style={{ fontWeight:500 }}>{fmtCur(bill.total)}</span>
                  </div>
                  
                  {billPayments.length > 0 && billPayments.map((p, i) => (
                      <div key={p.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:12, fontSize:13 }}>
                         <span style={{ color:"#6b7280" }}>Received ({p.mode})</span>
                         <span style={{ fontWeight:500, color:"#16a34a" }}>{fmtCur(p.amount)}</span>
                      </div>
                  ))}

                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12, fontSize:13 }}>
                     <span style={{ color:"#6b7280" }}>Total Amount Received</span>
                     <span style={{ fontWeight:500 }}>{fmtCur(payInfo.paidAmount)}</span>
                  </div>
                  
                  <div style={{ display:"flex", justifyContent:"space-between", paddingTop:12, borderTop:"1px dashed #d1d5db", fontSize:14, fontWeight:600, color:"#dc2626" }}>
                     <span>Balance Amount</span>
                     <span>{fmtCur(payInfo.remaining)}</span>
                  </div>
               </div>

               {/* Banner Removed */}
            </div>
         </div>
      </div>

      {showPaymentModal && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"white", padding:24, borderRadius:8, width:400 }}>
                  <h3 style={{ margin:"0 0 16px 0", color: "#111827", fontSize: 18 }}>Record Payment In</h3>
                  <div style={{ marginBottom: 16 }}>
                      <label style={{ display:"block", fontSize:12, color:"#6b7280", marginBottom:4 }}>Amount Received</label>
                      <input type="number" min="0" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} placeholder="0.00" style={{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:6, outline: "none" }} />
                  </div>
                  <div style={{ marginBottom: 24 }}>
                      <label style={{ display:"block", fontSize:12, color:"#6b7280", marginBottom:4 }}>Payment Mode</label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:6, outline: "none" }}>
                          <option value="cash">Cash</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="upi">UPI</option>
                          <option value="cheque">Cheque</option>
                      </select>
                  </div>
                  <div style={{ display:"flex", gap:12 }}>
                      <button onClick={() => setShowPaymentModal(false)} className="btn" style={{ flex:1, border:"1px solid #d1d5db", background:"white", color: "#374151" }}>Cancel</button>
                      <button onClick={handleSavePayment} className="btn" style={{ flex:1, background:"#16a34a", color:"white", border:"none" }}>Save Payment</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}


function TasksPage({ tasks, setTasks, workers, vendors, user, showToast, addNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const firstWorkerId = workers[0]?.id ?? "";
  const firstVendorId = (vendors || [])[0]?.id ?? "";
  const [form, setForm] = useState({ title: "", customer: "", assigneeType: "worker", worker: firstWorkerId, vendor: firstVendorId, deadline: "", notes: "" });
  const [editForm, setEditForm] = useState({ title: "", customer: "", deadline: "", notes: "" });

  useEffect(() => {
    if (workers.length > 0 && form.assigneeType === "worker" && !workers.some(w => w.id === form.worker))
      setForm(f => ({ ...f, worker: workers[0].id }));
    if ((vendors || []).length > 0 && form.assigneeType === "vendor" && !(vendors || []).some(v => v.id === form.vendor))
      setForm(f => ({ ...f, vendor: vendors[0].id }));
  }, [workers, vendors, form.assigneeType]);

  useEffect(() => {
    const handler = () => { if (editTask) setEditTask(null); else if (showModal) setShowModal(false); };
    window.addEventListener("pm-close-modal", handler);
    return () => window.removeEventListener("pm-close-modal", handler);
  }, [showModal, editTask]);

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
      organisationId: user?.organisationId,
    };
    const saved = await db.addTask(task);
    setTasks(t => [saved || task, ...t]);
    setShowModal(false);
    setForm({ title:"",customer:"",assigneeType:"worker",worker:workers[0]?.id??"",vendor:(vendors||[])[0]?.id??"",deadline:"",notes:"" });
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
  const saveEdit = async () => {
    if (!editTask || !(editForm.title || "").trim()) return showToast("Title required", "error");
    const updated = { ...editTask, title: editForm.title.trim(), customer: (editForm.customer || "").trim() || null, deadline: (editForm.deadline || "").trim() || null, notes: (editForm.notes || "").trim() || null };
    setTasks(t => t.map(x => x.id === editTask.id ? updated : x));
    await db.updateTask(editTask.id, { title: updated.title, customer: updated.customer, deadline: updated.deadline, notes: updated.notes });
    setEditTask(null);
    setEditForm({ title: "", customer: "", deadline: "", notes: "" });
    showToast("Task updated");
    const assigneeName = updated.worker ? (workers.find(w => w.id === updated.worker)?.name) : (vendors?.find(v => v.id === updated.vendor)?.name);
    if (assigneeName) addNotification(`Task "${updated.title}" was edited by admin. Assigned to: ${assigneeName}`);
  };
  const sc = s => s === "Completed" ? "badge-green" : s === "In Progress" ? "badge-blue" : "badge-yellow";
  const isAdmin = user?.role === "admin";
  const nowDate = new Date();
  const cleanTasks = tasks.filter(t => !(t.title || "").includes("Restock Required"));
  const overdueTasks = cleanTasks.filter(t => t.deadline && new Date(t.deadline) < nowDate && t.status !== "Completed");
  const filterOpts = [
    ["All", null, cleanTasks.length],
    ["Pending", "Pending", cleanTasks.filter(t=>t.status==="Pending").length],
    ["In Progress", "In Progress", cleanTasks.filter(t=>t.status==="In Progress").length],
    ["Completed", "Completed", cleanTasks.filter(t=>t.status==="Completed").length],
    ["Overdue", "overdue", overdueTasks.length],
    ["Incomplete", "incomplete", cleanTasks.filter(t=>t.status!=="Completed").length],
  ];
  const [taskFilter, setTaskFilter] = useState("all");
  let filteredTasks = taskFilter === "all" ? cleanTasks
    : taskFilter === "overdue" ? overdueTasks
    : taskFilter === "incomplete" ? cleanTasks.filter(t => t.status !== "Completed")
    : cleanTasks.filter(t => t.status === taskFilter);

  const statusOrder = { "Pending": 1, "In Progress": 2, "Completed": 3 };
  filteredTasks.sort((a, b) => {
    const aOrd = statusOrder[a.status] || 99;
    const bOrd = statusOrder[b.status] || 99;
    if (aOrd !== bOrd) return aOrd - bOrd;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

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
                {isAdmin&&<button className="btn btn-sm btn-ghost" title="Edit task" onClick={()=>{setEditTask(t);setEditForm({title:t.title,customer:t.customer||"",deadline:t.deadline||"",notes:t.notes||""});}}><Icon name="edit" size={12}/></button>}
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
      {editTask&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditTask(null)}>
          <div className="modal"><div className="modal-title">Edit Task</div>
            <p style={{fontSize:".8rem",color:"var(--text2)",marginBottom:16}}>Changes will be saved and the assignee will be notified.</p>
            <div className="form-grid">
              <div className="form-group full"><label>Task Title *</label><input value={editForm.title} onChange={e=>setEditForm({...editForm,title:e.target.value})} /></div>
              <div className="form-group"><label>Customer</label><input value={editForm.customer} onChange={e=>setEditForm({...editForm,customer:e.target.value})} /></div>
              <div className="form-group"><label>Deadline</label><input type="date" value={editForm.deadline} onChange={e=>setEditForm({...editForm,deadline:e.target.value})} /></div>
              <div className="form-group full"><label>Notes</label><textarea value={editForm.notes} onChange={e=>setEditForm({...editForm,notes:e.target.value})} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-ghost" onClick={()=>setEditTask(null)}>Cancel</button><button className="btn btn-primary" onClick={saveEdit}><Icon name="check" size={14}/>Save changes</button></div>
          </div>
        </div>
      )}
    </div>
  );
}



// ── Add Vendor Payment Modal ──────────────────────────────────────────────────
function AddVendorPaymentModal({ vendorBill, vendorPayments, vendors, onAdd, onClose }) {
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const info = getVendorBillPaymentInfo(vendorBill, vendorPayments);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-title">Record Vendor Payment</div>
        <div style={{ marginBottom: 16, padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: ".85rem" }}>
          <div><strong>{vendorBill.id}</strong> · {vendors.find(v => v.id === vendorBill.vendor_id)?.name || vendorBill.vendor_id}</div>
          <div style={{ marginTop: 4, color: "var(--text2)" }}>Total: {fmtCur(vendorBill.amount)} · Paid: {fmtCur(info.paidAmount)} · Remaining: {fmtCur(info.remaining)}</div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Payment method</label>
            <select value={method} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Amount (₹)</label>
            <input type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} placeholder={info.remaining} />
          </div>
          <div className="form-group full">
            <label>Notes (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Cheque #123" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onAdd(method, amount, note); }}>Record Payment</button>
        </div>
      </div>
    </div>
  );
}

// ── Vendors ───────────────────────────────────────────────────────────────────
function VendorsPage({ vendors, workers, setVendors, vendorBills, setVendorBills, vendorPayments, setVendorPayments, showToast, brand, user }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", firmName: "", username: "", password: "", phone: "", email: "" });
  const [billVendorFilter, setBillVendorFilter] = useState("all");
  const [billStatusFilter, setBillStatusFilter] = useState("all"); // all | unpaid | paid | partial
  const [recordPaymentBill, setRecordPaymentBill] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSection, setMobileSection] = useState("bills"); // vendors | bills

  useEffect(() => {
    try {
      const mq = window.matchMedia("(max-width: 768px)");
      const apply = () => setIsMobile(!!mq.matches);
      apply();
      if (mq.addEventListener) mq.addEventListener("change", apply);
      else mq.addListener(apply);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener("change", apply);
        else mq.removeListener(apply);
      };
    } catch {
      setIsMobile(false);
      return undefined;
    }
  }, []);

  const add = async () => {
    if(user?.organisationPlan === "free" && ((workers?.length||0) + vendors.length) >= 3) {
      return showToast("Free plan limit: Max 3 Vendors & Workers combined. Upgrade to Pro.", "error");
    }
    if (!form.name || !form.username || !form.password) return showToast("Name, username and password required", "error");
    if (vendors.find(v => v.username === form.username)) return showToast("Username already taken", "error");
    try {
      // #region agent log
      fetch('http://127.0.0.1:7590/ingest/7bb49d42-87e4-4411-a67b-74994a07da53', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Debug-Session-Id': '914820',
        },
        body: JSON.stringify({
          sessionId: '914820',
          runId: 'initial',
          hypothesisId: 'H4',
          location: 'App.jsx:VendorsPage.add',
          message: 'Adding vendor',
          data: { name: form.name, username: form.username },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const saved = await db.addVendor({ ...form, firmName: form.firmName, organisationId: user?.organisationId });
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

  const addVendorPaymentToBill = async (vendorBillId, method, amount, note) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return showToast("Enter a valid amount", "error");
    const saved = await db.addVendorPayment({
      vendorBillId,
      organisationId: user?.organisationId,
      method: method || "cash",
      amount: amt,
      note: note || null,
    });
    if (saved) {
      setVendorPayments(prev => [saved, ...prev]);
      const vb = vendorBills.find(b => (b.id || b.bill_number) === vendorBillId);
      const info = getVendorBillPaymentInfo(vb, [saved, ...(vendorPayments || [])]);
      if (info.isPaid) {
        setVendorBills(bs => bs.map(x => (x.id || x.bill_number) === vendorBillId ? { ...x, paid: true } : x));
        await db.updateVendorBillPaid(vendorBillId, true);
      }
      showToast(`Vendor payment of ${fmtCur(amt)} recorded`);
      setRecordPaymentBill(null);
    }
  };

  const getVendorName = (id) => vendors.find(v => v.id === id)?.name || id;
  const vendorBillsInScope = vendorBills.filter(b => billVendorFilter === "all" ? true : b.vendor_id === billVendorFilter);
  const vendorBillsUnpaid = vendorBillsInScope.filter(b => !getVendorBillPaymentInfo(b, vendorPayments).isPaid && getVendorBillPaymentInfo(b, vendorPayments).paidAmount <= 0);
  const vendorBillsPartial = vendorBillsInScope.filter(b => getVendorBillPaymentInfo(b, vendorPayments).status === "Partially Paid");
  const vendorBillsPaid = vendorBillsInScope.filter(b => getVendorBillPaymentInfo(b, vendorPayments).isPaid);
  const visibleVendorBills = vendorBillsInScope.filter(b => {
    const info = getVendorBillPaymentInfo(b, vendorPayments);
    if (billStatusFilter === "paid") return info.isPaid;
    if (billStatusFilter === "unpaid") return !info.isPaid && info.paidAmount <= 0;
    if (billStatusFilter === "partial") return info.status === "Partially Paid";
    return true;
  });

  const vendorsCard = (
    <div className="card">
      <div className="card-title">Vendors</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {vendors.map(v => (
          <div key={v.id} style={{ padding: 12, background: "var(--surface2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div><div style={{ fontWeight: 700 }}>{v.name}</div><div style={{ fontSize: ".72rem", color: "var(--text3)" }}>{v.firm_name || "—"}</div></div>
              <span className="badge badge-purple">Vendor</span>
            </div>
            <div style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 4 }}>Login ID: <span style={{color:"var(--primary)", fontWeight:600}}>{v.username}</span></div>
            <div style={{ fontSize: ".65rem", fontFamily: "var(--mono)", color: "var(--text3)", marginBottom: 8 }}>ID: {v.id}</div>
            <div className="flex gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setBillVendorFilter(v.id);
                  setBillStatusFilter("all");
                  if (isMobile) setMobileSection("bills");
                  showToast("Showing bill history for: " + (v.name || v.username), "info");
                }}
              >
                Bill History
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => removeVendor(v.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const billsCard = (
    <div className="card">
      <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span>Vendor Bills (History)</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ minWidth: 220, flex: "1 1 220px" }}>
            <select value={billVendorFilter} onChange={e => setBillVendorFilter(e.target.value)}>
              <option value="all">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name || v.username} ({v.firm_name || v.username})</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, fontSize: ".72rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(billStatusFilter === "all" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setBillStatusFilter("all")}
            >
              All ({vendorBillsInScope.length})
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(billStatusFilter === "unpaid" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setBillStatusFilter("unpaid")}
            >
              Unpaid ({vendorBillsUnpaid.length})
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(billStatusFilter === "partial" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setBillStatusFilter("partial")}
            >
              Partial ({vendorBillsPartial.length})
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(billStatusFilter === "paid" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setBillStatusFilter("paid")}
            >
              Paid ({vendorBillsPaid.length})
            </button>
          </div>
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Bill ID</th><th>Vendor</th><th>Description</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {vendorBills.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>No vendor bills yet</td></tr>}
          {vendorBills.length > 0 && visibleVendorBills.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 24 }}>
              No bills in this view. Try changing the vendor or status filter.
            </td></tr>
          )}
          {visibleVendorBills.map(b => {
            const info = getVendorBillPaymentInfo(b, vendorPayments);
            const bid = b.id ?? b.bill_number;
            const badgeClass = info.isPaid ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red";
            return (
              <tr key={bid}>
                <td className="font-mono" style={{ fontSize: ".78rem" }}>{bid}</td>
                <td>{getVendorName(b.vendor_id)}</td>
                <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{(b.description || "").slice(0, 40)}{(b.description||"").length > 40 ? "…" : ""}</td>
                <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(b.amount)}</td>
                <td><span className={`badge ${badgeClass}`}>{info.status}</span></td>
                <td>{!info.isPaid && <button className="btn btn-sm btn-success" onClick={() => setRecordPaymentBill(b)}>Record Payment</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <div style={{ marginTop: 10, fontSize: ".72rem", color: "var(--text3)" }}>
        Vendor bill history is permanent. Use Record Payment to log partial or full payments (Cash/UPI/Bank/Card).
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex justify-between mb-4" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: ".9rem", color: "var(--text2)" }}>{vendors.length} vendors</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />Add Vendor</button>
      </div>

      {isMobile ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 12, ...(mobileSection === "vendors" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setMobileSection("vendors")}
            >
              Vendors
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 12, ...(mobileSection === "bills" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setMobileSection("bills")}
            >
              Vendor Bills History
            </button>
          </div>
          {mobileSection === "vendors" ? vendorsCard : billsCard}
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, alignItems: "start" }}>
          {vendorsCard}
          {billsCard}
        </div>
      )}

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
      {recordPaymentBill && (
        <AddVendorPaymentModal
          vendorBill={recordPaymentBill}
          vendorPayments={vendorPayments}
          vendors={vendors}
          onAdd={(method, amount, note) => addVendorPaymentToBill(recordPaymentBill.id ?? recordPaymentBill.bill_number, method, amount, note)}
          onClose={() => setRecordPaymentBill(null)}
        />
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
  const [filter, setFilter] = useState("all"); // all | pending | paid

  const create = async () => {
    if (!form.description || !form.amount || form.amount <= 0) return showToast("Description and amount required", "error");
    const id = "VB-" + Date.now().toString().slice(-6);
    const bill = { id, vendorId: user.id, description: form.description, amount: Number(form.amount), paid: false, organisationId: user?.organisationId };
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
  const pendingCount = myBills.filter(b => !b.paid).length;
  const paidCount = myBills.filter(b => b.paid).length;

  const visibleBills = myBills.filter(b => {
    if (filter === "pending") return !b.paid;
    if (filter === "paid") return !!b.paid;
    return true;
  });

  return (
    <div>
      <div className="flex justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: ".9rem", color: "var(--text2)" }}>Create bills for {brand?.shopName || "the company"} — amount you want to be paid</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />Submit Bill</button>
      </div>
      <div className="card">
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>My Submitted Bills (History)</span>
          <div style={{ display: "flex", gap: 6, fontSize: ".72rem", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(filter === "all" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setFilter("all")}
            >
              All ({myBills.length})
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(filter === "pending" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setFilter("pending")}
            >
              Pending ({pendingCount})
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ paddingInline: 10, ...(filter === "paid" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
              onClick={() => setFilter("paid")}
            >
              Paid ({paidCount})
            </button>
          </div>
        </div>
        <div className="table-wrap"><table>
          <thead><tr><th>Bill ID</th><th>Description</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {myBills.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills yet. Click Submit Bill to create one.</td></tr>}
            {myBills.length > 0 && visibleBills.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
                No bills in this view. Try switching the filter above.
              </td></tr>
            )}
            {visibleBills.map(b => (
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
function PurchasesPage({ purchases, setPurchases, showToast, user }) {
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
      organisationId: user?.organisationId,
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
        <thead><tr><th>Purchase ID</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th><th>Date</th><th>Source</th><th>Actions</th></tr></thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No purchases yet</td></tr>
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
              <td style={{ fontSize: ".7rem" }}>
                {p.billImage || p.ocrText ? <span className="badge badge-blue">Posted</span> : null}
              </td>
              <td style={{ whiteSpace: "nowrap", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button className="btn btn-sm btn-danger" onClick={() => removePurchase(p.id)}><Icon name="trash" size={12} /></button>
              </td>
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

function PostedBillsPage({ purchases, setPurchases, showToast, user }) {
  const [inputMode, setInputMode] = useState("image"); // "image" | "text"
  const [pastedText, setPastedText] = useState("");
  const [parsedTextPreview, setParsedTextPreview] = useState("");
  const [parseNote, setParseNote] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [form, setForm] = useState({
    supplier: "",
    billDate: "",
    items: [{ name: "", qty: 1, price: 0 }],
    totalAmount: 0,
    notes: "Posted via image",
  });
  const imageContainerRef = useRef(null);
  const totalInputRef = useRef(null);
  const [itemTemplates, setItemTemplates] = useState(() => {
    try {
      const raw = localStorage.getItem("pm_item_templates");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      showToast("Please select an image file", "error");
      return;
    }
    setFile(f);
    loadAndResizeImage(f, 1600, 1600)
      .then(dataUrl => {
        setPreviewUrl(dataUrl);
        if (imageContainerRef.current) {
          imageContainerRef.current.scrollTop = 0;
        }
      })
      .catch(() => {
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
      });
  };

  const updateItem = (idx, key, value) => {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [key]: key === "qty" || key === "price" ? Number(value) || 0 : value } : it);
      return { ...f, items };
    });
  };

  const addItemRow = () => {
    setForm(f => ({ ...f, items: [...f.items, { name: "", qty: 1, price: 0 }] }));
  };

  const removeItemRow = (idx) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const computedTotal = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);

  const updateTemplatesFromItems = (items) => {
    const names = items.map(it => it.name).filter(Boolean);
    setItemTemplates(prev => {
      const set = new Set(prev);
      names.forEach(n => set.add(n));
      const next = Array.from(set).slice(0, 50);
      try {
        localStorage.setItem("pm_item_templates", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const scrollToRatio = (ratio) => {
    const el = imageContainerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) return;
    el.scrollTop = maxScroll * ratio;
  };

  const focusItemsArea = () => scrollToRatio(0.3);
  const focusTotalsArea = () => scrollToRatio(0.85);

  const applyParsedPurchase = (rawText) => {
    if (!rawText) return;
    setParsedTextPreview(rawText.replace(/\r/g, "\n").trim());
    const parsed = parsePurchaseFromRaw(rawText);
    setForm((f) => ({
      ...f,
      supplier: parsed.supplierName || f.supplier,
      billDate: parsed.billDate || f.billDate,
      items:
        parsed.items?.length > 0
          ? parsed.items.map((it) => ({
              name: it.name,
              qty: it.qty || 1,
              price: it.price || 0,
            }))
          : f.items,
      totalAmount: parsed.totalAmount || f.totalAmount || computedTotal,
      notes: "Posted via image OCR",
    }));
    setParseNote(
      parsed.totalAmount > 0
        ? `OCR parsed: supplier, date, ${
            parsed.items?.length || 0
          } item(s), total ₹${parsed.totalAmount}`
        : "OCR parsed text. Review and adjust fields below."
    );
  };

  const handleRunOcr = async () => {
    if (!previewUrl) {
      showToast("Upload a bill image first", "error");
      return;
    }
    setOcrError("");
    setOcrLoading(true);
    try {
      const text = await runPurchaseOcr(previewUrl);
      if (!text) {
        setOcrError("Could not read any text. Try a clearer photo.");
        return;
      }
      applyParsedPurchase(text);
    } catch (e) {
      setOcrError(e.message || "Failed to run OCR");
    } finally {
      setOcrLoading(false);
    }
  };

  const handleParseText = () => {
    let raw = pastedText.trim();
    if (!raw) {
      showToast("Paste bill text or HTML first", "error");
      return;
    }
    let plainText = raw;
    if (raw.includes("<") && raw.includes(">")) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, "text/html");
        plainText = (doc.body?.textContent || doc.documentElement?.textContent || raw).replace(/\r/g, "\n").trim();
      } catch {
        plainText = raw;
      }
    } else {
      plainText = raw.replace(/\r/g, "\n").trim();
    }
    setParsedTextPreview(plainText);

    const parsed = parsePurchaseFromRaw(raw);
    setForm(f => ({
      ...f,
      supplier: parsed.supplierName || f.supplier,
      billDate: parsed.billDate || f.billDate,
      items: parsed.items?.length > 0
        ? parsed.items.map(it => ({ name: it.name, qty: it.qty || 1, price: it.price || 0 }))
        : f.items,
      totalAmount: parsed.totalAmount || f.totalAmount || computedTotal,
      notes: "Posted via text",
    }));
    setParseNote(parsed.totalAmount > 0 ? `Parsed: supplier, date, ${parsed.items?.length || 0} item(s), total ₹${parsed.totalAmount}` : "Parsed. Review and adjust fields below.");
  };

  const savePostedBill = async () => {
    const firstItem = form.items[0] || { name: "", qty: 1, price: 0 };
    if (!form.supplier) return showToast("Supplier name is required", "error");
    if (!firstItem.name) return showToast("At least one item name is required", "error");
    const total = form.totalAmount || computedTotal;
    if (!total || total <= 0) return showToast("Total amount must be greater than zero", "error");

    let billImageDataUrl = null;
    let ocrTextContent = "";
    if (inputMode === "text") {
      ocrTextContent = parsedTextPreview || pastedText || "";
    }
    if (inputMode === "image" && (file || (previewUrl && typeof previewUrl === "string" && previewUrl.startsWith("data:")))) {
      if (file) {
        billImageDataUrl = await readFile64(file);
      } else {
        billImageDataUrl = previewUrl;
      }
    }

    updateTemplatesFromItems(form.items);

    const summaryLines = inputMode === "text" && ocrTextContent
      ? ocrTextContent
      : [
          `Supplier: ${form.supplier}`,
          form.billDate ? `Bill Date: ${form.billDate}` : null,
          "",
          "Items:",
          ...form.items.map(it => `- ${it.name} | Qty: ${it.qty} | Price: ${it.price}`),
          "",
          `Total Amount: ${total}`,
          form.notes ? `Notes: ${form.notes}` : null,
        ].filter(Boolean);

    const purchase = {
      id: "PB" + Date.now().toString().slice(-6),
      supplier: form.supplier,
      item: form.items.length > 1 ? `${firstItem.name} + ${form.items.length - 1} more` : firstItem.name,
      qty: firstItem.qty || 1,
      rate: firstItem.price || total,
      total,
      notes: form.notes,
      createdAt: now(),
      organisationId: user?.organisationId,
      billDate: form.billDate || null,
      billImage: billImageDataUrl,
      ocrText: typeof summaryLines === "string" ? summaryLines : summaryLines.join("\n"),
      items: form.items.map(it => ({
        name: it.name,
        qty: Number(it.qty) || 0,
        price: Number(it.price) || 0,
      })),
    };

    const saved = await db.addPurchase(purchase);
    setPurchases(ps => [saved || purchase, ...ps]);
    showToast("Posted bill saved to Purchases", "success");

    setFile(null);
    setPreviewUrl(null);
    setZoom(1);
    setPastedText("");
    setParsedTextPreview("");
    setParseNote("");
    setForm({
      supplier: "",
      billDate: "",
      items: [{ name: "", qty: 1, price: 0 }],
      totalAmount: 0,
      notes: inputMode === "text" ? "Posted via text" : "Posted via image",
    });
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.altKey) return;
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        focusTotalsArea();
        if (totalInputRef.current) {
          totalInputRef.current.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Posted Bills (OCR)</div>
        <p style={{ fontSize: ".8rem", color: "var(--text3)", marginTop: 4 }}>
          Upload or capture supplier purchase bills. Zoom into the items and totals while typing on the right to record bills quickly and accurately.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.1fr) minmax(320px, 1.2fr)", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="card-title" style={{ margin: 0 }}>Bill Source</div>
            <div className="segmented" style={{ flexShrink: 0 }}>
              <button type="button" className={`segmented-btn ${inputMode === "image" ? "active" : ""}`} onClick={() => setInputMode("image")}>
                Bill Image
              </button>
              <button type="button" className={`segmented-btn ${inputMode === "text" ? "active" : ""}`} onClick={() => setInputMode("text")}>
                Text / HTML
              </button>
            </div>
          </div>

          {inputMode === "image" ? (
            <>
          <div className="form-group">
            <label>Upload or capture bill photo</label>
            <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
            <div style={{ fontSize: ".75rem", color: "var(--text3)", marginTop: 4 }}>
              Tip: Capture the full bill in good lighting for best results. Zoom and scroll to read line items and totals easily.
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleRunOcr}
                disabled={ocrLoading || !previewUrl}
              >
                {ocrLoading ? "Reading…" : "Read Text (OCR beta)"}
              </button>
              <span style={{ fontSize: ".72rem", color: "var(--text3)" }}>
                Works best on printed bills. Handwritten notes may be inaccurate.
              </span>
            </div>
            {ocrError && (
              <div style={{ fontSize: ".75rem", color: "var(--danger)", marginTop: 6 }}>
                {ocrError}
              </div>
            )}
          </div>
          {previewUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: ".78rem", fontWeight: 600 }}>Preview</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: ".72rem", color: "var(--text3)" }}>Zoom</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom(z => Math.max(0.8, z - 0.2))}>-</button>
                  <span style={{ fontSize: ".78rem", minWidth: 32, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setZoom(z => Math.min(2.0, z + 0.2))}>+</button>
                </div>
              </div>
              <div ref={imageContainerRef} style={{ maxHeight: 380, overflow: "auto", borderRadius: 8, border: "1px solid var(--border)", padding: 8, background: "var(--surface2)" }}>
                <img
                  src={previewUrl}
                  alt="bill-preview"
                  style={{
                    width: "100%",
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                    display: "block",
                  }}
                />
              </div>
            </div>
          )}
            </>
          ) : (
            <>
          <div className="form-group">
            <label>Paste bill text or HTML</label>
            <textarea
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="Paste HTML (e.g. from posted-bills.html) or plain text from a bill..."
              rows={8}
              style={{ fontSize: 14, fontFamily: "monospace" }}
            />
            <button type="button" className="btn btn-primary" onClick={handleParseText} style={{ marginTop: 8 }}>
              Parse Text
            </button>
            {parseNote && <div style={{ fontSize: ".78rem", color: "var(--accent)", marginTop: 8 }}>{parseNote}</div>}
          </div>
          {parsedTextPreview && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: ".78rem", fontWeight: 600, marginBottom: 6 }}>Parsed plain text</div>
              <pre style={{ fontSize: 12, maxHeight: 240, overflow: "auto", background: "var(--surface2)", padding: 10, borderRadius: 8, border: "1px solid var(--border)", whiteSpace: "pre-wrap", wordBreak: "break-word" }} readOnly>
                {parsedTextPreview}
              </pre>
            </div>
          )}
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">Purchase Details</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Supplier Name</label>
              <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Bill Date</label>
              <input
                value={form.billDate}
                onChange={e => setForm(f => ({ ...f, billDate: e.target.value }))}
                placeholder="13 Mar 2026 or 13/03/2026"
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Items</div>
            <div className="table-wrap" style={{ maxHeight: 260, overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140 }}>Item Name</th>
                    <th style={{ width: 70 }}>Qty</th>
                    <th style={{ width: 110 }}>Price</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          list="pm-item-templates"
                          value={it.name}
                          onChange={e => updateItem(idx, "name", e.target.value)}
                          onFocus={focusItemsArea}
                        />
                      </td>
                      <td><input type="number" min={0} value={it.qty} onChange={e => updateItem(idx, "qty", e.target.value)} /></td>
                      <td><input type="number" min={0} value={it.price} onChange={e => updateItem(idx, "price", e.target.value)} /></td>
                      <td>
                        {form.items.length > 1 && (
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeItemRow(idx)}>
                            <Icon name="trash" size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" style={{ marginTop: 8 }} onClick={addItemRow}>
              <Icon name="plus" size={12} /> Add Item
            </button>
          </div>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Total Amount</label>
            <input
              type="number"
              min={0}
              ref={totalInputRef}
              value={form.totalAmount || computedTotal}
              onChange={e => setForm(f => ({ ...f, totalAmount: Number(e.target.value) || 0 }))}
              onFocus={focusTotalsArea}
            />
            <div style={{ fontSize: ".72rem", color: "var(--text3)", marginTop: 4 }}>
              Auto-calculated from items: {fmtCur(computedTotal)}. You can override if needed.
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button className="btn btn-primary" type="button" onClick={savePostedBill}>
              Save Posted Bill
            </button>
          </div>
        </div>
      </div>
      <datalist id="pm-item-templates">
        {itemTemplates.map(name => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────
function PaymentsPage({ bills, setBills, billPayments, setBillPayments, showToast, user }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | paid | unpaid | partial
  const [addPaymentBill, setAddPaymentBill] = useState(null);

  const paid = bills.filter(b => getBillPaymentInfo(b, billPayments).isPaid);
  const unpaid = bills.filter(b => {
    const info = getBillPaymentInfo(b, billPayments);
    return !info.isPaid && info.paidAmount <= 0;
  });
  const partial = bills.filter(b => {
    const info = getBillPaymentInfo(b, billPayments);
    return !info.isPaid && info.paidAmount > 0;
  });
  const tReceived = (billPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const tOutstanding = bills.reduce((s, b) => s + getBillPaymentInfo(b, billPayments).remaining, 0);
  const methodTotals = (billPayments || []).reduce((acc, p) => {
    const m = (p.method || "cash").toLowerCase();
    acc[m] = (acc[m] || 0) + (Number(p.amount) || 0);
    return acc;
  }, {});

  const addPaymentToBill = async (billId, method, amount, note) => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return showToast("Enter a valid amount", "error");
    const saved = await db.addBillPayment({ billId, organisationId: user?.organisationId, method: method || "cash", amount: amt, note: note || null });
    if (saved) {
      setBillPayments(prev => [saved, ...prev]);
      const bill = bills.find(b => b.id === billId);
      const info = getBillPaymentInfo(bill, [saved, ...(billPayments || [])]);
      if (info.isPaid) {
        setBills(bs => bs.map(x => x.id === billId ? { ...x, paid: true } : x));
        await db.updateBillPaid(billId, true);
      }
      showToast(`Payment of ${fmtCur(amt)} recorded`);
      setAddPaymentBill(null);
    }
  };

  const filtered = bills.filter(b =>
    !search ||
    (b.customer || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.id || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.phone || "").includes(search)
  );

  const visibleBills = filtered.filter(b => {
    const info = getBillPaymentInfo(b, billPayments);
    if (statusFilter === "paid") return info.isPaid;
    if (statusFilter === "unpaid") return !info.isPaid && info.paidAmount <= 0;
    if (statusFilter === "partial") return info.status === "Partially Paid";
    return true;
  });

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", marginBottom: 20 }}>
        <div className="stat-card" style={{"--c1":"#10b981","--c2":"#059669"}}><div className="stat-value" style={{fontSize:"1.1rem"}}>{fmtCur(tReceived)}</div><div className="stat-label">Total Received</div></div>
        <div className="stat-card" style={{"--c1":"#ef4444","--c2":"#dc2626"}}><div className="stat-value" style={{fontSize:"1.1rem"}}>{fmtCur(tOutstanding)}</div><div className="stat-label">Outstanding</div></div>
        <div className="stat-card" style={{"--c1":"#4f67ff","--c2":"#7c3aed"}}><div className="stat-value" style={{fontSize:"1.05rem"}}>{fmtCur(tReceived + tOutstanding)}</div><div className="stat-label">Total Billed</div></div>
        {["cash","upi","bank","card"].filter(m => (methodTotals[m] || 0) > 0).map(m => (
          <div key={m} className="stat-card" style={{"--c1":"#06b6d4","--c2":"#0891b2"}}><div className="stat-value" style={{fontSize:".95rem"}}>{fmtCur(methodTotals[m])}</div><div className="stat-label">{m.charAt(0).toUpperCase() + m.slice(1)}</div></div>
        ))}
      </div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{width:280}}><Icon name="search" size={14} color="var(--text3)"/><input placeholder="Search payments…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div style={{ display: "flex", gap: 6, fontSize: ".72rem" }}>
          <button
            className="btn btn-sm btn-ghost"
            style={{ paddingInline: 10, ...(statusFilter === "all" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
            onClick={() => setStatusFilter("all")}
          >
            All ({bills.length})
          </button>
          <button
            className="btn btn-sm btn-ghost"
            style={{ paddingInline: 10, ...(statusFilter === "unpaid" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
            onClick={() => setStatusFilter("unpaid")}
          >
            Unpaid ({unpaid.length})
          </button>
          <button
            className="btn btn-sm btn-ghost"
            style={{ paddingInline: 10, ...(statusFilter === "partial" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
            onClick={() => setStatusFilter("partial")}
          >
            Partial ({partial.length})
          </button>
          <button
            className="btn btn-sm btn-ghost"
            style={{ paddingInline: 10, ...(statusFilter === "paid" ? { background: "var(--accent-soft)", color: "var(--accent)" } : {}) }}
            onClick={() => setStatusFilter("paid")}
          >
            Paid ({paid.length})
          </button>
        </div>
      </div>
      <div className="card"><div className="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
        <tbody>
          {bills.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills yet</td></tr>
          )}
          {bills.length > 0 && visibleBills.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>No bills in this view. Try changing the filter above.</td></tr>
          )}
          {visibleBills.map(b=>{
            const info = getBillPaymentInfo(b, billPayments);
            const badgeClass = info.isPaid ? "badge-green" : info.status === "Partially Paid" ? "badge-yellow" : "badge-red";
            return (
              <tr key={b.id}>
                <td className="font-mono" style={{color:"var(--accent)",fontWeight:700,fontSize:".78rem"}}>{b.id}</td>
                <td style={{fontWeight:600}}>{b.customer}</td>
                <td className="font-mono" style={{fontWeight:700}}>{fmtCur(b.total)}</td>
                <td><span className={`badge ${badgeClass}`}>{info.status}</span></td>
                <td style={{fontSize:".72rem",color:"var(--text3)"}}>{fmtDate(b.createdAt)}</td>
                <td>{!info.isPaid && <button className="btn btn-sm btn-success" onClick={()=>setAddPaymentBill(b)}>Add Payment</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div></div>
      {addPaymentBill && (
        <AddPaymentModal
          bill={addPaymentBill}
          billPayments={billPayments}
          onAdd={(method, amount, note) => addPaymentToBill(addPaymentBill.id, method, amount, note)}
          onClose={() => setAddPaymentBill(null)}
        />
      )}
    </div>
  );
}

// ── Customers ─────────────────────────────────────────────────────────────────
function CustomersPage({ customers, bills }) {
  const [sel, setSel] = useState(null);
  const [search, setSearch] = useState("");

  // Always derive customers from bills (so everyone with a bill appears), then
  // merge with DB customers for extra info (email) and to include any DB-only customers.
  const fromBills = Object.values(
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
  const norm = (c) => (String(c.phone || "").replace(/\D/g, "") || (c.name || "").toLowerCase() || c.id || "");
  const byKey = new Map();
  fromBills.forEach((c) => byKey.set(norm(c), c));
  (customers || []).forEach((c) => {
    const k = norm(c);
    if (!k) return;
    if (byKey.has(k)) Object.assign(byKey.get(k), c);
    else byKey.set(k, { ...c, id: c.id || c.phone });
  });
  const baseCustomers = Array.from(byKey.values());

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
            const matchBill = (b) => {
              const phMatch = (b.phone||"").replace(/\D/g,"") === (c.phone||"").replace(/\D/g,"");
              const nameMatch = (b.customer||"").toLowerCase() === (c.name||"").toLowerCase();
              return phMatch || nameMatch;
            };
            const cb = bills.filter(matchBill);
            return <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>setSel(c)}><td><div style={{fontWeight:600}}>{c.name}</div></td><td style={{fontFamily:"var(--mono)",fontSize:".78rem"}}>{c.phone}</td><td>{cb.length}</td><td className="font-mono" style={{fontWeight:700}}>{fmtCur(cb.reduce((s,b)=>s+b.total,0))}</td></tr>;
          })}</tbody>
        </table></div></div>
        {sel&&<div className="card">
          <div className="flex justify-between mb-3"><div className="card-title" style={{marginBottom:0}}>{sel.name}</div><button className="btn btn-sm btn-ghost" onClick={()=>setSel(null)}><Icon name="x" size={12}/></button></div>
          <div style={{fontSize:".8rem",color:"var(--text2)",marginBottom:12}}>{sel.phone}{sel.email?` · ${sel.email}`:""}</div>
          <div style={{fontWeight:600,fontSize:".78rem",marginBottom:8}}>Bill History</div>
          {bills.filter(b=>{const ph=(x)=>(String(x||"").replace(/\D/g,""));return ph(b.phone)===ph(sel.phone)||(b.customer||"").toLowerCase()===(sel.name||"").toLowerCase();}).map(b=>(
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
function ReportsPage({ bills, customers, tasks }) {
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const md=months.map((m,i)=>{const b=bills.filter(b=>new Date(b.createdAt).getMonth()===i);return{month:m,total:b.reduce((s,x)=>s+x.total,0),count:b.length};});
  const mx=Math.max(...md.map(d=>d.total),1);
  const tr=bills.filter(b=>b.paid).reduce((s,b)=>s+b.total,0);
  const avg=bills.length?bills.reduce((s,b)=>s+b.total,0)/bills.length:0;
  const exportCustomers = (customers && customers.length > 0 ? customers : null) || [];
  const exportTasks = tasks || [];
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
        <div className="card"><div className="card-title">Summary &amp; Backup (CSV / Excel)</div>
          {[["Paid Bills",bills.filter(b=>b.paid).length,"badge-green"],["Unpaid Bills",bills.filter(b=>!b.paid).length,"badge-red"],["With GST",bills.filter(b=>b.gst).length,"badge-blue"],["Without GST",bills.filter(b=>!b.gst).length,"badge-purple"]].map(([l,v,c],i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<3?"1px solid var(--border)":"none"}}><span style={{fontSize:".82rem",color:"var(--text2)"}}>{l}</span><span className={`badge ${c}`}>{v}</span></div>
          ))}
          <div style={{ fontSize: ".75rem", color: "var(--text3)", marginTop: 8, marginBottom: 8 }}>
            Use these CSV exports as a backup and open them directly in Excel.
          </div>
          <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={()=>{
            const csv=["Invoice,Customer,Description,Total,Paid,Date,Due Date,Phone,Email",...bills.map(b=>`${b.id||""},${b.customer||""},"${(b.desc||"").replace(/"/g,'""')}",${b.total},${b.paid},${fmtDate(b.createdAt)},${b.dueDate||""},${b.phone||""},${b.email||""}`)].join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="bills-backup.csv";a.click();
          }}><Icon name="export" size={13}/>Download Bills CSV (Excel)</button>
          <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={()=>{
            const csv=["Name,Phone,Email,Created At",...exportCustomers.map(c=>`${(c.name||"").replace(/,/g," ")},${c.phone||""},${c.email||""},${c.createdAt?fmtDate(c.createdAt):""}`)].join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="customers-backup.csv";a.click();
          }} disabled={exportCustomers.length===0}><Icon name="export" size={13}/>Download Customers CSV</button>
          <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={()=>{
            const csv=["Task,Customer,Assignee,Status,Deadline,Created At,Notes",...exportTasks.map(t=>{
              const assignee=(t.worker||t.worker_id||"")||(t.vendor||t.vendor_id||"");
              return `${(t.title||"").replace(/,/g," ")},${(t.customer||"").replace(/,/g," ")},${String(assignee||"").replace(/,/g," ")},${t.status||""},${t.deadline||""},${t.createdAt?fmtDate(t.createdAt):""},"${(t.notes||"").replace(/"/g,'""')}"`;
            })].join("\n");
            const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="tasks-backup.csv";a.click();
          }} disabled={exportTasks.length===0}><Icon name="export" size={13}/>Download Tasks CSV</button>
        </div>
      </div>
    </div>
  );
}

// ── Products / Services ───────────────────────────────────────────────────────
function ProductsPage({ products, setProducts, showToast, user }) {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "product", itemCode: "", hsnCode: "", unit: "PCS", defaultRate: 0, purchasePrice: 0, openingStock: 0, stockAsOf: new Date().toISOString().slice(0, 10), size: "", description: "", active: true });

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", category: "product", itemCode: "", hsnCode: "", unit: "PCS", defaultRate: 0, purchasePrice: 0, openingStock: 0, stockAsOf: new Date().toISOString().slice(0, 10), size: "", description: "", active: true });
  };

  const openNew = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      name: p.name || "",
      category: p.category || "product",
      itemCode: p.item_code || p.itemCode || "",
      hsnCode: p.hsn_code || p.hsnCode || "",
      unit: p.unit || "PCS",
      defaultRate: p.default_rate ?? p.defaultRate ?? 0,
      purchasePrice: p.purchase_price ?? p.purchasePrice ?? 0,
      openingStock: p.opening_stock ?? p.openingStock ?? 0,
      stockAsOf: p.stock_as_of || p.stockAsOf || new Date().toISOString().slice(0, 10),
      size: p.size || "",
      description: p.description || "",
      active: p.active !== false,
    });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      showToast("Enter item name", "error");
      return;
    }
    try {
      if (editing) {
        await db.updateProduct(editing.id, {
          name: form.name.trim(),
          category: form.category,
          itemCode: form.itemCode.trim() || null,
          hsnCode: form.hsnCode.trim() || null,
          unit: form.unit.trim() || null,
          defaultRate: Number(form.defaultRate) || 0,
          purchasePrice: Number(form.purchasePrice) || 0,
          openingStock: Number(form.openingStock) || 0,
          stockAsOf: form.stockAsOf || null,
          size: form.size.trim() || null,
          description: form.description.trim() || null,
          active: !!form.active,
        });
        setProducts(list =>
          list.map(p => p.id === editing.id
            ? {
                ...p,
                name: form.name.trim(),
                category: form.category,
                item_code: form.itemCode.trim() || null,
                hsn_code: form.hsnCode.trim() || null,
                unit: form.unit.trim() || null,
                default_rate: Number(form.defaultRate) || 0,
                purchase_price: Number(form.purchasePrice) || 0,
                opening_stock: Number(form.openingStock) || 0,
                stock_as_of: form.stockAsOf || null,
                size: form.size.trim() || null,
                description: form.description.trim() || null,
                active: !!form.active,
              }
            : p
          )
        );
        showToast("Item updated");
      } else {
        const created = await db.addProduct({
          name: form.name.trim(),
          category: form.category,
          itemCode: form.itemCode.trim() || null,
          hsnCode: form.hsnCode.trim() || null,
          unit: form.unit.trim() || null,
          defaultRate: Number(form.defaultRate) || 0,
          purchasePrice: Number(form.purchasePrice) || 0,
          openingStock: Number(form.openingStock) || 0,
          stockAsOf: form.stockAsOf || null,
          size: form.size.trim() || null,
          description: form.description.trim() || null,
          active: !!form.active,
          organisationId: user?.organisationId,
        });
        setProducts(list => [created, ...list]);
        showToast("Item added");
      }
      setShowModal(false);
      resetForm();
    } catch (e) {
      showToast(e.message || "Failed to save item", "error");
    }
  };

  const archive = async (p) => {
    await db.updateProduct(p.id, { active: false });
    setProducts(list => list.map(x => x.id === p.id ? { ...x, active: false } : x));
    showToast("Item archived");
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (p.name || "").toLowerCase().includes(q) ||
      (p.item_code || p.itemCode || "").toLowerCase().includes(q) ||
      (p.hsn_code || p.hsnCode || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q) ||
      (p.unit || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4" style={{ flexWrap: "wrap", gap: 10 }}>
        <div className="search-bar" style={{ width: 260 }}>
          <Icon name="search" size={14} color="var(--text3)" />
          <input placeholder="Search products / services…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={openNew}><Icon name="plus" size={14} />New Product</button>
      </div>

      <div className="card">
        <div className="card-title">Products & Services</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Item Code</th>
                <th>HSN</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Unit</th>
                <th>Default Rate</th>
                <th>Purchase Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", color: "var(--text3)", padding: 32 }}>
                    No products yet. Click “New Product” to add Tea, Flex Banner, Design Work, etc.
                  </td>
                </tr>
              )}
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td style={{ fontSize: ".8rem", color: "var(--text3)" }}>{p.category || "product"}</td>
                  <td>{p.unit || "—"}</td>
                  <td className="font-mono" style={{ fontWeight: 700 }}>{fmtCur(p.default_rate ?? p.defaultRate ?? 0)}</td>
                  <td>
                    <span className={`badge ${p.active !== false ? "badge-green" : "badge-red"}`}>
                      {p.active !== false ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(p)}><Icon name="edit" size={12} />Edit</button>
                      {p.active !== false && (
                        <button className="btn btn-sm btn-danger" onClick={() => archive(p)}><Icon name="trash" size={12} />Archive</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowModal(false), resetForm())}>
          <div className="modal">
            <div className="modal-title">{editing ? "Edit Product / Service" : "New Product / Service"}</div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tea, Flex Banner, Design Work…" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
              </div>
              <div className="form-group">
                <label>Unit</label>
                <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs, sqft, hour…" />
              </div>
              <div className="form-group">
                <label>Default Rate (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={form.defaultRate}
                  onChange={e => setForm({ ...form, defaultRate: +e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Item Code</label>
                <input value={form.itemCode} onChange={e => setForm({ ...form, itemCode: e.target.value.toUpperCase() })} placeholder="ITM12549" />
              </div>
              <div className="form-group">
                <label>HSN Code</label>
                <input value={form.hsnCode} onChange={e => setForm({ ...form, hsnCode: e.target.value })} placeholder="4010" />
              </div>
              <div className="form-group">
                <label>Default Size</label>
                <input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} placeholder="A4 / 10x4 ft" />
              </div>
              <div className="form-group">
                <label>Purchase Price (Rs)</label>
                <input type="number" min={0} value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: +e.target.value })} />
              </div>
              <div className="form-group">
                <label>Opening Stock</label>
                <input type="number" value={form.openingStock} onChange={e => setForm({ ...form, openingStock: +e.target.value })} />
              </div>
              <div className="form-group">
                <label>As of Date</label>
                <input type="date" value={form.stockAsOf} onChange={e => setForm({ ...form, stockAsOf: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Item description or notes" />
              </div>
              <div className="form-group">
                <label>Status</label>
                <div className="toggle-wrap" onClick={() => setForm({ ...form, active: !form.active })}>
                  <button className={`toggle ${form.active ? "on" : ""}`} />
                  <span className="toggle-label">{form.active ? "Active" : "Archived"}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save}><Icon name="billing" size={14} />Save</button>
            </div>
          </div>
        </div>
      )}
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
  const mt = tasks.filter(t => t.worker === user.id);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", customer: "", deadline: "", notes: "" });

  useEffect(() => {
    const handler = () => showModal && setShowModal(false);
    window.addEventListener("pm-close-modal", handler);
    return () => window.removeEventListener("pm-close-modal", handler);
  }, [showModal]);

  const addMyTask = async () => {
    if (!(form.title || "").trim()) return showToast("Enter a task title", "error");
    const task = {
      id: "T" + Date.now().toString().slice(-4),
      status: "Pending",
      createdAt: now(),
      title: (form.title || "").trim(),
      customer: (form.customer || "").trim() || null,
      deadline: (form.deadline || "").trim() || null,
      notes: (form.notes || "").trim() || null,
      worker: user.id,
      vendor: null,
      organisationId: user?.organisationId,
    };
    const saved = await db.addTask(task);
    setTasks(t => [saved || task, ...t]);
    setShowModal(false);
    setForm({ title: "", customer: "", deadline: "", notes: "" });
    showToast("Task added to your list");
  };

  const upd = async (id, status) => {
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));
    await db.updateTaskStatus(id, status);
    if (status === "Completed") addNotification("Task completed by " + user.name + ": " + tasks.find(t => t.id === id)?.title);
    showToast(status === "Completed" ? "🎉 Task completed! Admin notified." : "Status updated");
  };
  const sc = s => s === "Completed" ? "badge-green" : s === "In Progress" ? "badge-blue" : "badge-yellow";
  return (
    <div>
      <div className="flex justify-between items-center mb-4" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>My Assigned Tasks</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="plus" size={14} />Add my own task</button>
      </div>
      <div className="card">
        {mt.length === 0 && <div style={{ textAlign: "center", color: "var(--text3)", padding: 40 }}>No tasks yet. Add one above or wait for admin to assign.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mt.map(t => (
            <div key={t.id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><div style={{ fontWeight: 700 }}>{t.title}</div><div style={{ fontSize: ".72rem", color: "var(--text3)", marginTop: 2 }}>{t.customer || "No customer"} · Deadline: {t.deadline || "Not set"}</div></div>
                <span className={`badge ${sc(t.status)}`}>{t.status}</span>
              </div>
              {t.notes && <div style={{ fontSize: ".78rem", color: "var(--text2)", marginBottom: 10 }}>{t.notes}</div>}
              <div className="flex gap-2">
                {t.status === "Pending" && <button className="btn btn-sm btn-primary" onClick={() => upd(t.id, "In Progress")}>Start Working</button>}
                {t.status === "In Progress" && <button className="btn btn-sm btn-success" onClick={() => upd(t.id, "Completed")}>Mark Completed ✓</button>}
                {t.status === "Completed" && <span style={{ fontSize: ".78rem", color: "var(--success)", fontWeight: 600 }}>✓ Admin notified</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Add my own task</div>
            <p style={{ fontSize: ".8rem", color: "var(--text2)", marginBottom: 16 }}>Create a task for yourself. It will appear in your list and you can update its status.</p>
            <div className="form-grid">
              <div className="form-group full"><label>Task title *</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Print 500 visiting cards" /></div>
              <div className="form-group"><label>Customer (optional)</label><input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Customer name" /></div>
              <div className="form-group"><label>Deadline (optional)</label><input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
              <div className="form-group full"><label>Notes (optional)</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Extra details…" rows={2} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addMyTask}><Icon name="plus" size={14} />Add task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GST SUITE PAGES
// ══════════════════════════════════════════════════════════════════════════════

// ── GST Suite Hub ─────────────────────────────────────────────────────────────
function GstSuitePage({ setPage }) {
  const tiles = [
    { id: "gst-finder",  emoji: "🔍", title: "GST Finder",   desc: "Verify any GSTIN instantly — get business name, status, and address.", color: "#4F6BFF" },
    { id: "e-invoice",   emoji: "🧾", title: "E-Invoice",    desc: "Generate IRN & QR code for GST-compliant e-invoices.", color: "#10B981" },
    { id: "e-waybill",   emoji: "🚛", title: "E-Way Bill",   desc: "Create, track and cancel E-Way Bills for goods movement.", color: "#7C3AED" },
    { id: "gst-filing",  emoji: "📊", title: "GST Filing",   desc: "Auto-compute GSTR-1 & GSTR-3B from your bills.", color: "#F59E0B" },
  ];
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: 20, background: "linear-gradient(135deg,#4F6BFF,#7C3AED)", color: "#fff", border: "none" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏛️</div>
        <div style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 6 }}>GST Compliance Suite</div>
        <div style={{ opacity: .85, fontSize: ".95rem" }}>All GST tools in one place — powered by Sandbox.co.in live API</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
        {tiles.map(t => (
          <div key={t.id} className="card"
            onClick={() => setPage(t.id)}
            style={{ cursor: "pointer", borderTop: `4px solid ${t.color}`, transition: "transform .15s,box-shadow .15s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
          >
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>{t.emoji}</div>
            <div style={{ fontWeight: 700, marginBottom: 4, color: t.color }}>{t.title}</div>
            <div style={{ fontSize: ".82rem", color: "var(--text2)" }}>{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 20, fontSize: ".82rem", color: "var(--text2)", display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span style={{ fontSize: "1.1rem" }}>ℹ️</span>
        <span>These features use your Sandbox.co.in API key. Make sure your GST number is configured in <strong>Settings → Company Details</strong> before generating E-Invoices or E-Way Bills.</span>
      </div>
    </div>
  );
}

// ── GST Finder ────────────────────────────────────────────────────────────────
function GstFinderPage({ user, showToast, supabase }) {
  const [gstin, setGstin] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [localMatch, setLocalMatch] = useState(null);

  // Indian state codes map
  const STATE_CODES = {
    "01":"Jammu & Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh",
    "05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh",
    "10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur",
    "15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal",
    "20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh",
    "24":"Gujarat","25":"Daman & Diu","26":"Dadra & Nagar Haveli","27":"Maharashtra",
    "28":"Andhra Pradesh (Old)","29":"Karnataka","30":"Goa","31":"Lakshadweep",
    "32":"Kerala","33":"Tamil Nadu","34":"Puducherry","35":"Andaman & Nicobar",
    "36":"Telangana","37":"Andhra Pradesh","38":"Ladakh"
  };

  const ENTITY_TYPES = {
    "C":"Company","P":"Individual/Proprietor","F":"Firm (Partnership)","H":"Hindu Undivided Family (HUF)",
    "A":"Association of Persons","T":"Trust","B":"Body of Individuals","L":"Local Authority",
    "J":"Artificial Juridical Person","G":"Government","E":"LLP (Limited Liability Partnership)"
  };

  // Decode GSTIN locally (no API needed)
  const decodeGstin = (g) => {
    const stateCode = g.substring(0, 2);
    const pan = g.substring(2, 12);
    const entityNum = g.charAt(12);
    const panEntityChar = g.charAt(5); // 4th char of PAN = entity type

    return {
      gstin: g,
      stateCode,
      stateName: STATE_CODES[stateCode] || "Unknown State",
      pan,
      entityType: ENTITY_TYPES[panEntityChar] || "Unknown Entity",
      entityNumber: entityNum === "1" ? "Primary" : `Branch ${entityNum}`,
      panEntityChar,
    };
  };

  const lookup = async () => {
    const clean = gstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
      setErr("Invalid GSTIN format. Must be 15 characters (e.g. 29ABCDE1234F1Z5)");
      return;
    }
    setLoading(true); setErr(""); setResult(null); setLocalMatch(null);

    // 1. Decode locally (instant, free)
    const decoded = decodeGstin(clean);

    // 2. Check Supabase for matching customers/vendors
    try {
      if (supabase && user?.organisationId) {
        const { data: customers } = await supabase
          .from("customers")
          .select("name, phone, email, gstin, address")
          .eq("organisation_id", user.organisationId)
          .eq("deleted", false)
          .ilike("gstin", clean);
        if (customers && customers.length > 0) {
          setLocalMatch(customers[0]);
        }
      }
    } catch (e) { /* ignore local lookup errors */ }

    // 3. Try Sandbox API (if key configured & subscription active)
    try {
      const res = await fetch(`/api/sandbox/gst/compliance/taxpayer/${clean}`, {
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        const d = json.data;
        setResult({
          gstin: d.gstin || clean,
          tradeName: d.trade_name || d.tradeName || "—",
          legalName: d.legal_name || d.legalName || "—",
          status: d.status || d.sts || "—",
          constitution: d.constitution_of_business || d.ctb || decoded.entityType,
          regDate: d.registration_date || d.rgdt || "—",
          address: d.address || "—",
          state: d.state || decoded.stateName,
          source: "live",
        });
        setLoading(false);
        return;
      }
    } catch (e) { /* Sandbox unavailable, continue with decoded data */ }

    // 4. Set decoded result (works offline, free forever)
    setResult({
      gstin: clean,
      tradeName: localMatch?.name || "—",
      legalName: localMatch?.name || "—",
      status: "Format Valid ✓",
      constitution: decoded.entityType,
      regDate: "—",
      address: localMatch?.address || "—",
      state: decoded.stateName,
      pan: decoded.pan,
      entityNumber: decoded.entityNumber,
      source: "decoded",
    });
    setLoading(false);
  };

  const isActive = result?.status?.toLowerCase()?.includes("active") || result?.status?.includes("Valid");

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">🔍 GST Number Verification</div>
        <p style={{ fontSize: ".85rem", color: "var(--text2)", marginBottom: 14 }}>
          Enter any GSTIN to decode state, PAN, entity type, and cross-reference your customer database.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={gstin} onChange={e => { setGstin(e.target.value.toUpperCase()); setErr(""); }}
            placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15}
            style={{ flex: 1, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase" }}
            onKeyDown={e => e.key === "Enter" && lookup()}
          />
          <button className="btn btn-primary" onClick={lookup} disabled={loading || !gstin}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </div>
        {err && <div style={{ marginTop: 10, color: "var(--danger)", fontSize: ".85rem" }}>⚠️ {err}</div>}
      </div>

      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          {/* Source badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{
              background: result.source === "live" ? "#DBEAFE" : "#FEF3C7",
              color: result.source === "live" ? "#1E40AF" : "#92400E",
              borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: ".72rem", textTransform: "uppercase"
            }}>
              {result.source === "live" ? "🌐 Live Sandbox API" : "📋 GSTIN Decoder (Offline)"}
            </span>
            <span style={{ background: isActive ? "#D1FAE5" : "#FEF3C7", color: isActive ? "#065F46" : "#92400E", borderRadius: 8, padding: "4px 12px", fontWeight: 700, fontSize: ".82rem" }}>
              {isActive ? "✅ " + result.status : result.status}
            </span>
          </div>

          {/* Business name */}
          <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 12, color: "var(--text1)" }}>
            {result.tradeName !== "—" ? result.tradeName : result.legalName !== "—" ? result.legalName : result.gstin}
          </div>

          {/* Details grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: ".88rem" }}>
            {[
              ["GSTIN", result.gstin],
              ["State", result.state],
              ["Legal Name", result.legalName],
              ["Trade Name", result.tradeName],
              ["Constitution", result.constitution],
              ["Registration Date", result.regDate],
              result.pan && ["Embedded PAN", result.pan],
              result.entityNumber && ["Branch Type", result.entityNumber],
              ["Address", result.address],
            ].filter(Boolean).map(([k, v]) => (
              <div key={k} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <div style={{ fontSize: ".72rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: .5, fontWeight: 600 }}>{k}</div>
                <div style={{ fontWeight: 600, color: "var(--text1)", marginTop: 2, fontFamily: k === "GSTIN" || k === "Embedded PAN" ? "monospace" : "inherit" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Decoded info banner */}
          {result.source === "decoded" && (
            <div style={{
              marginTop: 14, padding: "10px 14px", borderRadius: 8,
              background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
              border: "1px solid #C7D2FE", fontSize: ".8rem", color: "#3730A3"
            }}>
              <strong>💡 Decoded from GSTIN format:</strong> State <strong>{result.state}</strong>, 
              Entity type <strong>{result.constitution}</strong>, 
              PAN <strong style={{ fontFamily: "monospace" }}>{result.pan}</strong>, 
              {result.entityNumber}. 
              <span style={{ opacity: 0.7 }}> — Enable Sandbox paid plan for full live verification.</span>
            </div>
          )}
        </div>
      )}

      {/* Local database match */}
      {localMatch && (
        <div className="card" style={{ border: "2px solid #10B981" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 6, padding: "3px 10px", fontWeight: 700, fontSize: ".75rem" }}>
              🏢 FOUND IN YOUR DATABASE
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", fontSize: ".88rem" }}>
            {[
              ["Customer Name", localMatch.name],
              ["Phone", localMatch.phone],
              ["Email", localMatch.email],
              ["GSTIN", localMatch.gstin],
              ["Address", localMatch.address],
            ].filter(([,v]) => v).map(([k, v]) => (
              <div key={k} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <div style={{ fontSize: ".72rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: .5, fontWeight: 600 }}>{k}</div>
                <div style={{ fontWeight: 600, color: "var(--text1)", marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !err && !loading && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px", color: "var(--text3)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🛡️</div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text1)", marginBottom: 6 }}>Verify any GSTIN instantly</div>
          <div style={{ fontSize: ".85rem", lineHeight: 1.6 }}>
            Decode state, PAN, entity type from any GST number.<br/>
            Automatically cross-references your customer database.
          </div>
        </div>
      )}
    </div>
  );
}

// ── E-Invoice Page ────────────────────────────────────────────────────────────
function EInvoicePage({ bills, user, showToast }) {
  const [selectedBill, setSelectedBill] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const SANDBOX_KEY = import.meta.env.VITE_SANDBOX_API_KEY || "";

  const unpaidGstBills = (bills || []).filter(b => b.gst && !b.irn && !b.deleted);

  const generate = async () => {
    if (!selectedBill) return showToast("Select a bill first", "error");
    const bill = bills.find(b => b.id === selectedBill);
    if (!bill) return;
    setLoading(true); setResult(null);
    try {
      // Get org settings for seller GSTIN
      const { data: settings } = await supabase
        .from("settings").select("gst_number").eq("organisation_id", user?.organisationId ?? "").limit(1).maybeSingle();
      if (!settings?.gst_number) throw new Error("Set your GST number in Settings → Company Details first.");

      const now = new Date();
      const invoiceDate = [String(now.getDate()).padStart(2,"0"), String(now.getMonth()+1).padStart(2,"0"), now.getFullYear()].join("/");

      const res = await fetch("/api/sandbox/gst/einvoice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          seller_gstin: settings.gst_number,
          buyer_name: bill.customerName || bill.customer || "Consumer",
          invoice_number: bill.id,
          invoice_date: invoiceDate,
          invoice_value: bill.total || 0,
          cgst: (bill.gst_amt || 0) / 2,
          sgst: (bill.gst_amt || 0) / 2,
          igst: 0,
          items: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);

      const irn = json?.data?.irn || json?.irn;
      const ack_no = json?.data?.ack_no || json?.ack_no;
      if (!irn) throw new Error("IRN not returned. Check your Sandbox credentials.");

      // Save to Supabase
      await supabase.from("bills").update({ irn, ack_no }).eq("id", bill.id);
      setResult({ irn, ack_no, ack_dt: json?.data?.ack_dt, signed_qr_code: json?.data?.signed_qr_code });
      showToast("E-Invoice generated! IRN saved to bill.");
    } catch (e) {
      showToast(e.message || "Generation failed", "error");
    }
    setLoading(false);
  };

  // Also list existing IRNs
  const existingIrns = (bills || []).filter(b => b.irn).slice(0, 10);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">🧾 Generate E-Invoice (IRN)</div>
        <p style={{ fontSize: ".85rem", color: "var(--text2)", marginBottom: 14 }}>
          Select a GST bill to generate an Invoice Reference Number (IRN) + QR code via the IRP portal.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
          <select value={selectedBill} onChange={e => { setSelectedBill(e.target.value); setResult(null); }}>
            <option value="">— Select a GST bill —</option>
            {unpaidGstBills.map(b => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.customerName || b.customer || "Consumer"} · ₹{(b.total || 0).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !selectedBill}>
            {loading ? "Generating…" : "⚡ Generate IRN"}
          </button>
        </div>
        {unpaidGstBills.length === 0 && (
          <div style={{ marginTop: 12, fontSize: ".84rem", color: "var(--text2)" }}>
            ℹ️ No eligible bills found. Create a bill with GST enabled to generate an e-invoice.
          </div>
        )}
      </div>

      {result && (
        <div className="card" style={{ borderTop: "4px solid #10B981" }}>
          <div style={{ fontWeight: 700, color: "#10B981", marginBottom: 12 }}>✅ E-Invoice Generated Successfully</div>
          {[["IRN", result.irn], ["Ack No", result.ack_no], ["Ack Date", result.ack_dt]].map(([k, v]) => v ? (
            <div key={k} style={{ display: "flex", gap: 10, paddingBottom: 6, borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, minWidth: 80, color: "var(--text2)", fontSize: ".82rem" }}>{k}</span>
              <span style={{ fontFamily: "monospace", fontSize: ".82rem", wordBreak: "break-all" }}>{v}</span>
            </div>
          ) : null)}
        </div>
      )}

      {existingIrns.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ marginBottom: 12 }}>Recent E-Invoices</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Bill ID</th><th>Customer</th><th>IRN</th><th>Amount</th></tr></thead>
            <tbody>
              {existingIrns.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: "monospace", fontSize: ".8rem" }}>{b.id}</td>
                  <td>{b.customerName || b.customer || "—"}</td>
                  <td><span style={{ fontFamily: "monospace", fontSize: ".75rem", color: "var(--text2)" }}>{(b.irn || "").slice(0, 20)}…</span></td>
                  <td>₹{(b.total || 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

// ── E-Way Bill Page ───────────────────────────────────────────────────────────
function EWayBillPage({ bills, user, showToast }) {
  const [form, setForm] = useState({ billId: "", partyName: "", pinFrom: "", pinTo: "", vehicleNo: "", value: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [ewbs, setEwbs] = useState([]);
  const SANDBOX_KEY = import.meta.env.VITE_SANDBOX_API_KEY || "";

  useEffect(() => {
    if (!user?.organisationId) return;
    supabase.from("eway_bills").select("*").eq("organisation_id", user.organisationId)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setEwbs(data || []));
  }, [user?.organisationId]);

  const generate = async () => {
    if (!form.partyName || !form.value || !form.pinFrom || !form.pinTo) {
      return showToast("Fill Party Name, Value, From PIN and To PIN", "error");
    }
    setLoading(true); setResult(null);
    try {
      const { data: settings } = await supabase
        .from("settings").select("gst_number").eq("organisation_id", user?.organisationId ?? "").limit(1).maybeSingle();
      if (!settings?.gst_number) throw new Error("Set your GST number in Settings → Company Details first.");

      const now = new Date();
      const docDate = [String(now.getDate()).padStart(2,"0"), String(now.getMonth()+1).padStart(2,"0"), now.getFullYear()].join("/");
      const totalValue = parseFloat(form.value) || 0;
      const taxableValue = totalValue * 0.85;
      const halfGst = (totalValue - taxableValue) / 2;

      const res = await fetch("/api/sandbox/gst/ewayBill/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          supplyType: "O", subSupplyType: "1", docType: "INV",
          docNo: form.billId || `WEB-${Date.now()}`, docDate,
          fromGstin: settings.gst_number, fromPincode: parseInt(form.pinFrom) || 0,
          toGstin: "URP", toPincode: parseInt(form.pinTo) || 0,
          transactionType: "1", totInvValue: totalValue, taxableAmount: taxableValue,
          cgstValue: halfGst, sgstValue: halfGst, igstValue: 0, cessValue: 0,
          transMode: "1", vehicleNo: form.vehicleNo || "", vehicleType: "R", distance: 0,
          itemList: [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      const ewbNo = String(json?.data?.ewbNo || json?.ewbNo || "");
      if (!ewbNo) throw new Error(json?.data?.message || "EWB number not returned.");

      await supabase.from("eway_bills").insert({
        organisation_id: user?.organisationId ?? "",
        ewb_no: ewbNo, party_name: form.partyName,
        total_value: totalValue, document_number: form.billId || null,
        vehicle_number: form.vehicleNo || null, status: "ACTIVE",
        ewb_date: json?.data?.ewbDt, valid_upto: json?.data?.validUpto,
      });

      setResult({ ewbNo, validUpto: json?.data?.validUpto, ewbDt: json?.data?.ewbDt });
      setForm({ billId: "", partyName: "", pinFrom: "", pinTo: "", vehicleNo: "", value: "" });
      showToast(`E-Way Bill ${ewbNo} generated!`);
      // Refresh list
      const { data } = await supabase.from("eway_bills").select("*").eq("organisation_id", user.organisationId).order("created_at", { ascending: false }).limit(20);
      setEwbs(data || []);
    } catch (e) {
      showToast(e.message || "Generation failed", "error");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 750, margin: "0 auto" }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">🚛 Generate E-Way Bill</div>
        <p style={{ fontSize: ".85rem", color: "var(--text2)", marginBottom: 14 }}>Required for inter-state goods movement worth ≥ ₹50,000.</p>
        <div className="form-grid">
          <div className="form-group"><label>Bill / Invoice No</label><input value={form.billId} onChange={e => setForm({...form, billId: e.target.value})} placeholder="e.g. INV-001" /></div>
          <div className="form-group"><label>Party Name *</label><input value={form.partyName} onChange={e => setForm({...form, partyName: e.target.value})} placeholder="e.g. Mehta Textiles" /></div>
          <div className="form-group"><label>Total Value (₹) *</label><input type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})} placeholder="e.g. 75000" /></div>
          <div className="form-group"><label>Vehicle Number</label><input value={form.vehicleNo} onChange={e => setForm({...form, vehicleNo: e.target.value.toUpperCase()})} placeholder="e.g. GJ01AB1234" /></div>
          <div className="form-group"><label>From PIN Code *</label><input value={form.pinFrom} onChange={e => setForm({...form, pinFrom: e.target.value})} placeholder="380001" maxLength={6} /></div>
          <div className="form-group"><label>To PIN Code *</label><input value={form.pinTo} onChange={e => setForm({...form, pinTo: e.target.value})} placeholder="110001" maxLength={6} /></div>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={loading} style={{ marginTop: 8 }}>
          {loading ? "Generating…" : "⚡ Generate E-Way Bill"}
        </button>
      </div>

      {result && (
        <div className="card" style={{ borderTop: "4px solid #7C3AED", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#7C3AED", marginBottom: 10 }}>✅ E-Way Bill Generated</div>
          <div><strong>EWB No:</strong> {result.ewbNo}</div>
          {result.validUpto && <div style={{ marginTop: 4, fontSize: ".85rem", color: "var(--text2)" }}>Valid till: {result.validUpto}</div>}
        </div>
      )}

      {ewbs.length > 0 && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Recent E-Way Bills</div>
          <div className="table-wrap"><table>
            <thead><tr><th>EWB No</th><th>Party</th><th>Value</th><th>Valid Till</th><th>Status</th></tr></thead>
            <tbody>
              {ewbs.map(e => (
                <tr key={e.id}>
                  <td style={{ fontFamily: "monospace", fontWeight: 600 }}>{e.ewb_no}</td>
                  <td>{e.party_name}</td>
                  <td>₹{Number(e.total_value).toLocaleString("en-IN")}</td>
                  <td style={{ fontSize: ".8rem" }}>{e.valid_upto || "—"}</td>
                  <td><span className={`badge ${e.status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}

// ── GST Filing Page ───────────────────────────────────────────────────────────
function GstFilingPage({ bills, user, showToast }) {
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  
  const buildPeriods = () => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const dueD = new Date(d.getFullYear(), d.getMonth() + 1, 11);
      return {
        label: `${MONTH_NAMES[d.getMonth()]} ${yyyy}`,
        value: `${mm}-${yyyy}`,
        due: `11 ${MONTH_NAMES[dueD.getMonth()].slice(0,3)} ${dueD.getFullYear()}`,
        filed: i > 0,
      };
    });
  };

  const periods = buildPeriods();
  const [period, setPeriod] = useState(periods[0]);
  const [retType, setRetType] = useState("gstr1");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    computeSummary();
  }, [period, bills]);

  const computeSummary = () => {
    const [mm, yyyy] = period.value.split("-");
    const from = new Date(`${yyyy}-${mm}-01`);
    const to   = new Date(parseInt(yyyy), parseInt(mm), 0);

    const periodBills = (bills || []).filter(b => {
      const d = new Date(b.createdAt || b.created_at || 0);
      return d >= from && d <= to && !b.deleted;
    });

    const gstBills    = periodBills.filter(b => b.gst);
    const b2bBills    = gstBills.filter(b => b.buyerGstin || b.buyer_gstin);
    const b2cBills    = gstBills.filter(b => !b.buyerGstin && !b.buyer_gstin);
    const totalSales  = periodBills.reduce((s, b) => s + (b.total || 0), 0);
    const taxableValue = gstBills.reduce((s, b) => s + (b.subtotal || b.total || 0), 0);
    const totalGst    = gstBills.reduce((s, b) => s + (b.gst_amt || b.gstAmount || 0), 0);
    setSummary({
      totalSales, taxableValue,
      cgst: totalGst / 2, sgst: totalGst / 2, igst: 0,
      totalGst, itc: 0, netPayable: totalGst,
      b2bCount: b2bBills.length, b2cCount: b2cBills.length,
      invoiceCount: gstBills.length,
    });
  };

  const downloadJson = async () => {
    if (!summary) return;
    try {
      const [mm, yyyy] = period.value.split("-");
      const from = new Date(`${yyyy}-${mm}-01`);
      const to   = new Date(parseInt(yyyy), parseInt(mm), 0);

      const periodBills = (bills || []).filter(b => {
        const d = new Date(b.createdAt || b.created_at || 0);
        return d >= from && d <= to && !b.deleted;
      });

      const gstBills = periodBills.filter(b => b.gst);
      
      const { data: settings } = await supabase
        .from("settings").select("gst_number").eq("organisation_id", user?.organisationId ?? "").limit(1).maybeSingle();
      const gstin = settings?.gst_number || "GSTIN_NOT_SET";
      const fp = `${mm}${yyyy}`;
      let exportData = {};

      if (retType === "gstr1") {
        const b2b = [];
        const b2c = [];
        
        gstBills.forEach(b => {
          const invDate = new Date(b.createdAt || b.created_at || Date.now());
          const idt = `${String(invDate.getDate()).padStart(2,"0")}-${String(invDate.getMonth()+1).padStart(2,"0")}-${invDate.getFullYear()}`;
          const taxVal = Number(b.subtotal || b.total || 0).toFixed(2);
          const gstVal = Number(b.gst_amt || b.gstAmount || 0).toFixed(2);
          const cgst = (gstVal / 2).toFixed(2);
          const sgst = (gstVal / 2).toFixed(2);
          
          const invData = {
            inum: String(b.id),
            idt: idt,
            val: Number((b.total || 0).toFixed(2)),
            pos: "24-Gujarat",
            rchrg: "N",
            inv_typ: "R",
            itms: [{ num: 1, itm_det: { rt: 18, txval: Number(taxVal), camt: Number(cgst), samt: Number(sgst), iamt: 0 } }]
          };

          if (b.buyerGstin || b.buyer_gstin) {
            b2b.push({ ctin: b.buyerGstin || b.buyer_gstin, inv: [invData] });
          } else {
            b2c.push({ sply_ty: "INTRA", rt: 18, typ: "OE", pos: "24-Gujarat", txval: Number(taxVal), camt: Number(cgst), samt: Number(sgst) });
          }
        });

        exportData = { gstin, fp, version: "GST2.0.0", hash: "generated_hash", b2b, b2cs: b2c };
      } else {
        exportData = {
          gstin, ret_period: fp,
          details: {
            outward_supplies: {
              osup_det: { txval: Number(summary.taxableValue.toFixed(2)), iamt: 0, camt: Number(summary.cgst.toFixed(2)), samt: Number(summary.sgst.toFixed(2)), csamt: 0 }
            },
            itc_elg: { itc_net: { iamt: 0, camt: Number(summary.itc.toFixed(2)), samt: Number(summary.itc.toFixed(2)) } }
          }
        };
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const a = document.createElement("a");
      a.href = dataStr;
      a.download = `${retType.toUpperCase()}_${fp}_export.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`✅ ${retType.toUpperCase()} JSON Exported!`);
    } catch (err) {
      showToast("JSON Export failed", "error");
    }
  };

  const fmt = n => `₹${(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const isActive = !period.filed;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {periods.map(p => (
          <button key={p.value}
            onClick={() => { setPeriod(p); setSummary(null); }}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border)",
              background: period.value === p.value ? "var(--primary)" : "var(--surface)",
              color: period.value === p.value ? "#fff" : "var(--text1)",
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontSize: ".84rem",
            }}
          >{p.label} {p.filed ? "✅" : ""}</button>
        ))}
      </div>

      {/* Return type */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {["gstr1","gstr3b"].map(t => (
          <button key={t} onClick={() => setRetType(t)}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
              background: retType === t ? "#F59E0B" : "transparent", color: retType === t ? "#fff" : "var(--text2)",
              fontWeight: 700, fontSize: ".9rem" }}>
            {t === "gstr1" ? "GSTR-1" : "GSTR-3B"}
          </button>
        ))}
      </div>

      {/* Due date info */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", borderRadius: 10,
        background: period.filed ? "#D1FAE520" : "#FEF3C720",
        border: `1px solid ${period.filed ? "#10B98130" : "#F59E0B30"}`,
        marginBottom: 16, fontSize: ".85rem",
        color: period.filed ? "#065F46" : "#92400E" }}>
        <span>{period.filed ? "✅" : "⏰"}</span>
        <span>{period.filed ? `${period.label} — filed` : `Due: ${period.due} · Not yet filed`}</span>
      </div>

      {summary && (
        <div className="card">
          <div className="card-title">{retType === "gstr1" ? "GSTR-1" : "GSTR-3B"} Summary · {period.label}</div>

          <div style={{ display: "grid", gap: 6 }}>
            {[
              ["Total Sales", fmt(summary.totalSales)],
              ["Taxable Value", fmt(summary.taxableValue)],
              null,
              ...(retType === "gstr1" ? [
                ["B2B Invoices", `${summary.b2bCount} invoices`],
                ["B2C Invoices", `${summary.b2cCount} invoices`],
                null,
                ["CGST Collected", fmt(summary.cgst)],
                ["SGST Collected", fmt(summary.sgst)],
                ["IGST Collected", fmt(summary.igst)],
                null,
                ["Total GST", fmt(summary.totalGst), "#F59E0B"],
              ] : [
                ["Output Tax (GST)", fmt(summary.totalGst)],
                ["Input Tax Credit", fmt(summary.itc), "#10B981"],
                null,
                ["Net GST Payable", fmt(summary.netPayable), summary.netPayable > 0 ? "#EF4444" : "#10B981"],
              ]),
            ].map((row, i) => row === null
              ? <div key={i} style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
              : (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                  <span style={{ fontSize: ".88rem", color: "var(--text2)" }}>{row[0]}</span>
                  <span style={{ fontWeight: 700, color: row[2] || "var(--text1)" }}>{row[1]}</span>
                </div>
              )
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => window.open("https://services.gst.gov.in/services/login", "_blank")}>
              🌐 File on GST Portal
            </button>
            <button className="btn btn-ghost" onClick={downloadJson}>
              ⬇️ Download JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
