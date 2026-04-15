import { useState, useEffect, useCallback } from "react";
import {
  Zap, Shield, TrendingUp, FileText, Users,
  Smartphone, CheckCircle2, Menu, X, Moon, Sun, ArrowRight,
  Star, BadgeCheck, Package, CreditCard, Receipt,
  BarChart3, Globe, MessageSquare,
} from "lucide-react";
// No shadcn/ui dependencies — self-contained landing page
import { motion, AnimatePresence } from "framer-motion";

/* ──────────────────────────────────────────────
   SPARKLE TRAIL COMPONENT
   ────────────────────────────────────────────── */
const Sparkle = ({ x, y, size }) => (
  <motion.div
    initial={{ opacity: 1, scale: 0, rotate: 0 }}
    animate={{ opacity: 0, scale: 1, rotate: 180 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="absolute pointer-events-none z-[100]"
    style={{ left: x, top: y, width: size, height: size, transform: "translate(-50%,-50%)" }}
  >
    <svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 0L95 60L160 80L95 100L80 160L65 100L0 80L65 60L80 0Z" fill="white" style={{ filter: "drop-shadow(0 0 10px rgba(255,255,255,0.8))" }} />
    </svg>
  </motion.div>
);

const MagicalSparkles = () => {
  const [sparkles, setSparkles] = useState([]);
  useEffect(() => {
    let timeout;
    const handler = (e) => {
      if (Math.random() > 0.82) {
        const id = Math.random().toString(36).substr(2, 9);
        setSparkles((p) => [...p, { id, x: e.clientX, y: e.clientY, size: Math.random() * 20 + 10 }].slice(-15));
        clearTimeout(timeout);
        timeout = setTimeout(() => setSparkles([]), 1200);
      }
    };
    window.addEventListener("pointermove", handler);
    return () => { window.removeEventListener("pointermove", handler); clearTimeout(timeout); };
  }, []);
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {sparkles.map((s) => <Sparkle key={s.id} {...s} />)}
    </div>
  );
};

/* ──────────────────────────────────────────────
   INTRO PRELOADER
   ────────────────────────────────────────────── */
const IntroPreloader = ({ onDone }) => (
  <motion.div
    className="fixed inset-0 z-[200] bg-[#050a18] flex flex-col items-center justify-center"
    exit={{ opacity: 0, scale: 1.05 }}
    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
  >
    {/* Pulsing glow behind logo */}
    <motion.div
      animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 0.8] }}
      transition={{ duration: 2, ease: "easeInOut" }}
      className="absolute w-[400px] h-[400px] bg-indigo-500/30 blur-[120px] rounded-full"
    />
    {/* Logo icon */}
    <motion.div
      initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative z-10 w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-[2px] shadow-2xl shadow-indigo-500/40 mb-8"
    >
      <div className="w-full h-full bg-[#0a1128] rounded-[14px] flex items-center justify-center">
        <FileText className="w-10 h-10 text-indigo-400" />
      </div>
    </motion.div>
    {/* Brand name */}
    <motion.h1
      initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
      className="relative z-10 text-4xl md:text-5xl font-black text-white tracking-tight"
    >
      Shiromani Printers
    </motion.h1>
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.5 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="relative z-10 text-sm font-medium text-gray-400 mt-3 tracking-widest uppercase"
    >
      PrintMaster Pro
    </motion.p>
    {/* Loading bar */}
    <motion.div className="relative z-10 mt-10 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        onAnimationComplete={onDone}
        className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
      />
    </motion.div>
  </motion.div>
);

/* ──────────────────────────────────────────────
   HERO SCENES DATA
   ────────────────────────────────────────────── */
const HERO_SCENES = [
  {
    badge: "India's #1 Premium Billing Platform",
    heading: <>Billing & inventory for <br className="hidden md:block"/>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-amber-400">every business.</span></>,
    sub: "Create professional invoices in seconds, track payments, manage customers, and share invoices effortlessly.",
    visual: "dashboard",
  },
  {
    badge: "Powerful Features — Zero Complexity",
    heading: <>Everything you need.<br className="hidden md:block"/>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400">Fast & reliable.</span></>,
    sub: "GST invoicing, inventory tracking, payment management, multi-user access, and beautiful reports — all built in.",
    visual: "features",
  },
  {
    badge: "Trusted by 10,000+ businesses",
    heading: <>Explore and<br className="hidden md:block"/>
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400">scale enjoyable.</span></>,
    sub: "Join thousands of Indian entrepreneurs who have transformed their operations with our platform.",
    visual: "trust",
  },
];

/* ──────────────────────────────────────────────
   HERO VISUAL SUB-COMPONENTS
   ────────────────────────────────────────────── */
const DashboardVisual = () => (
  <motion.div
    initial={{ y: 200, opacity: 0, scale: 0.9 }}
    animate={{ y: 0, opacity: 1, scale: 1 }}
    exit={{ y: -100, opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
    className="w-full relative h-[380px] flex justify-center items-end"
  >
    {/* Center Card */}
    <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="absolute z-30 bottom-0 w-[580px] h-[330px] rounded-t-3xl border border-white/20 bg-[#1A1F36]/80 backdrop-blur-3xl shadow-[0_0_80px_-20px_rgba(99,102,241,0.4)] overflow-hidden"
      style={{ transform: "rotateX(5deg)" }}>
      <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-black/20">
        <div className="w-3 h-3 rounded-full bg-red-400" /><div className="w-3 h-3 rounded-full bg-amber-400" /><div className="w-3 h-3 rounded-full bg-green-400" />
        <div className="mx-auto text-xs font-semibold text-white/50">Admin Dashboard</div>
      </div>
      <div className="p-5 grid grid-cols-3 gap-3 h-full">
        <div className="col-span-2 space-y-3">
          <div className="h-28 rounded-xl bg-gradient-to-br from-indigo-500/20 to-transparent border border-white/5 flex items-center justify-center text-white/20 font-bold text-sm">📊 Sales Chart</div>
          <div className="h-16 rounded-xl bg-gradient-to-br from-fuchsia-500/15 to-transparent border border-white/5" />
        </div>
        <div className="col-span-1 space-y-3">
          {[{c:"bg-indigo-500/30",w:"w-14"},{c:"bg-amber-500/30",w:"w-10"},{c:"bg-emerald-500/30",w:"w-16"}].map((item,i)=>(
            <div key={i} className="h-14 rounded-xl bg-white/5 flex items-center px-3 gap-2"><div className={`w-7 h-7 rounded-full ${item.c}`}/><div className={`h-2 ${item.w} bg-white/20 rounded-full`}/></div>
          ))}
        </div>
      </div>
    </motion.div>
    {/* Left Card */}
    <motion.div animate={{ y: [0, -18, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
      className="absolute z-20 left-[3%] lg:left-[8%] bottom-8 w-[220px] lg:w-[260px] h-[280px] rounded-2xl border border-white/20 bg-[#1A1F36]/90 backdrop-blur-2xl shadow-2xl overflow-hidden"
      style={{ transform: "rotateX(10deg) rotateY(15deg)" }}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/30 flex items-center justify-center"><FileText className="w-4 h-4 text-indigo-400"/></div>
          <span className="text-xs font-bold text-white/40">Invoice #0042</span>
        </div>
        <div className="space-y-2 flex-1"><div className="h-3 w-3/4 bg-white/10 rounded"/><div className="h-3 w-1/2 bg-white/10 rounded"/><div className="mt-6 h-16 w-full bg-gradient-to-t from-white/5 to-transparent rounded border border-white/5"/></div>
        <div className="h-9 mt-auto w-full bg-emerald-500/20 rounded-lg border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">✓ Paid Successfully</div>
      </div>
    </motion.div>
    {/* Right Card */}
    <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      className="absolute z-20 right-[3%] lg:right-[8%] bottom-16 w-[220px] lg:w-[260px] h-[240px] rounded-2xl border border-white/20 bg-[#1A1F36]/90 backdrop-blur-2xl shadow-2xl overflow-hidden"
      style={{ transform: "rotateX(10deg) rotateY(-15deg)" }}>
      <div className="p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-5"><h4 className="text-white font-bold tracking-tight text-sm">Revenue</h4><div className="bg-white/10 p-1.5 rounded-lg"><TrendingUp className="w-4 h-4 text-green-400"/></div></div>
        <div className="text-2xl font-black text-white mb-3">₹1.2M</div>
        <div className="flex items-end gap-1.5 h-16 mt-auto w-full">
          {[40,60,30,80,100].map((h,i)=>(<div key={i} className={`w-1/5 rounded-t-sm ${i===4?"bg-gradient-to-t from-fuchsia-500/50 to-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.5)]":i===3?"bg-indigo-500/50":"bg-white/10"}`} style={{height:`${h}%`}}/>))}
        </div>
      </div>
    </motion.div>
  </motion.div>
);

const FeaturesVisual = () => {
  const items = [
    { icon: Receipt, label: "GST Invoicing", color: "from-indigo-500 to-blue-600" },
    { icon: Package, label: "Inventory", color: "from-emerald-500 to-teal-600" },
    { icon: CreditCard, label: "Payments", color: "from-amber-500 to-orange-600" },
    { icon: BarChart3, label: "Reports", color: "from-fuchsia-500 to-pink-600" },
    { icon: Users, label: "Multi-User", color: "from-cyan-500 to-blue-600" },
    { icon: MessageSquare, label: "WhatsApp", color: "from-green-500 to-emerald-600" },
  ];
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="w-full relative h-[380px] flex justify-center items-center"
    >
      <div className="grid grid-cols-3 gap-5 max-w-lg mx-auto">
        {items.map(({ icon: Icon, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0, y: [0, -8, 0] }}
            transition={{ delay: i * 0.1, duration: 0.5, y: { duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut" } }}
            className="flex flex-col items-center gap-3 w-32"
          >
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${color} p-[2px] shadow-lg`}>
              <div className="w-full h-full bg-[#0e1629] rounded-[14px] flex items-center justify-center">
                <Icon className="w-8 h-8 text-white" />
              </div>
            </div>
            <span className="text-white/80 text-sm font-semibold text-center mt-2">{label}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const TrustVisual = () => {
  const brands = ["10,000+", "₹500Cr+", "99.9%", "< 8 sec"];
  const labels = ["Businesses", "Invoices Processed", "Uptime", "Invoice Speed"];
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ duration: 0.7 }}
      className="w-full relative h-[380px] flex justify-center items-center"
    >
      <div className="grid grid-cols-2 gap-5 max-w-lg mx-auto">
        {brands.map((value, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [0, -6, 0] }}
            transition={{ delay: i * 0.15, duration: 0.5, y: { duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" } }}
            className="group relative px-8 py-10 text-center rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl hover:bg-white/10 transition-all duration-500 w-48"
          >
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="text-3xl lg:text-4xl font-black bg-gradient-to-br from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">{value}</div>
            <div className="text-sm font-medium text-gray-400">{labels[i]}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

/* ──────────────────────────────────────────────
   DATA
   ────────────────────────────────────────────── */
const FEATURES = [
  { icon: Receipt,    title: "GST Invoicing",      desc: "Generate fully compliant GST invoices in seconds. Auto-calculate taxes across all GST slabs with zero effort." },
  { icon: Package,    title: "Inventory Control",   desc: "Real-time stock tracking, low-stock alerts, and batch management — never run out or overstock again." },
  { icon: TrendingUp, title: "Business Analytics",  desc: "Live dashboards with profit, revenue, and expense breakdowns. Understand your business at a glance." },
  { icon: CreditCard, title: "Payment Tracking",    desc: "Record payments, send reminders, and reconcile dues. Collect what you're owed, faster." },
  { icon: Users,      title: "Multi-User Access",   desc: "Invite your team with role-based permissions. Everyone gets exactly what they need." },
  { icon: Smartphone, title: "Mobile-First",        desc: "Full-featured Android and iOS apps. Manage billing, inventory, and reports from anywhere." },
];

const TESTIMONIALS = [
  { name: "Rajesh Sharma",  role: "Owner, Delhi Traders",       rating: 5, text: "Switched from manual Excel sheets and never looked back. GST filing now takes minutes instead of days." },
  { name: "Priya Nair",     role: "CA, Nair & Associates",      rating: 5, text: "I recommend this to all my clients. Clean interface, accurate tax calculations, and reports auditors love." },
  { name: "Suresh Kumar",   role: "MD, Sunrise Electronics",    rating: 5, text: "The inventory management alone is worth it. Real-time stock visibility across three branches — brilliant." },
];

const PLANS = [
  { name: "Starter",      price: "Free",   period: "",         highlight: false, cta: "Get Started",    features: ["10 invoices / month", "1 user", "Basic inventory", "Email support"] },
  { name: "Professional", price: "₹999",   period: "/ month",  highlight: true,  cta: "Start Free Trial", features: ["Unlimited invoices", "5 users", "Advanced inventory", "GST returns", "Priority support", "Custom branding"] },
  { name: "Enterprise",   price: "Custom", period: "",         highlight: false, cta: "Contact Sales",  features: ["Everything in Pro", "Unlimited users", "Multi-branch", "API access", "Dedicated manager", "SLA guarantee"] },
];

const FAQS = [
  { q: "Is there a free trial?",            a: "Yes! Our Starter plan is free forever with 10 invoices per month. No credit card required." },
  { q: "Can I use this for GST billing?",   a: "Absolutely. 100% GST-compliant — CGST, SGST, IGST, and composition scheme all supported." },
  { q: "Is my data secure?",                a: "We use 256-bit AES encryption, daily encrypted backups, and ISO 27001-aligned security practices." },
  { q: "Can I access it on mobile?",        a: "Yes. Native apps for Android and iOS are available free of charge for all plan holders." },
  { q: "Can I migrate from another tool?",  a: "Yes, our onboarding team will help you import data from Tally, Excel, or any CSV export." },
];

/* ──────────────────────────────────────────────
   ANIMATION VARIANTS
   ────────────────────────────────────────────── */
const FADE_UP = (delay = 0) => ({
  initial: { opacity: 0, y: 40, filter: "blur(6px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] },
});

/* ──────────────────────────────────────────────
   MAIN COMPONENT
   ────────────────────────────────────────────── */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [currentScene, setCurrentScene] = useState(0);
  // Landing page is always dark-themed, no theme toggle needed
  const go = (path) => { try { window.location.href = path; } catch { window.location.assign(path); } };

  // Auto-cycle hero scenes every 6 seconds
  useEffect(() => {
    if (showIntro) return;
    const interval = setInterval(() => {
      setCurrentScene((prev) => (prev + 1) % HERO_SCENES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [showIntro]);

  const scene = HERO_SCENES[currentScene];

  return (
    <>
      <style>{`
        /* Landing page responsive CSS — guaranteed native media queries */
        .lp-nav-desktop { display: none; }
        .lp-nav-mobile { display: flex; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr; gap: 3rem; justify-content: center; margin-inline: auto; width: 100%; max-width: 1152px; align-items: stretch; }
        .lp-feature-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-inline: auto; width: 100%; max-width: 1280px; }
        .lp-testimonial-grid { display: grid; grid-template-columns: 1fr; gap: 4rem; align-items: center; }
        .lp-hero-section { padding-top: 6rem; padding-bottom: 4rem; }
        .lp-hero-heading { font-size: 2.5rem; }
        .lp-section-heading { font-size: 1.75rem; }
        .lp-section { padding-top: 8rem; padding-bottom: 8rem; width: 100%; display: flex; flex-direction: column; align-items: center; }
        .lp-section-sm { padding-top: 5rem; padding-bottom: 5rem; width: 100%; display: flex; flex-direction: column; align-items: center; }
        .lp-content-center { max-width: 1280px; margin-inline: auto; padding-inline: 1.5rem; width: 100%; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .lp-mb-16 { margin-bottom: 4rem; }
        .lp-mb-20 { margin-bottom: 5rem; }
        .lp-footer-bottom { display: flex; flex-direction: column; }
        .lp-footer-grid { display: grid; grid-template-columns: 1fr; gap: 3rem; width: 100%; max-width: 1280px; margin-inline: auto; padding-inline: 1.5rem; text-align: left; }
        .lp-col-span-2 { grid-column: span 1 / span 1; }
        
        @media (min-width: 768px) {
          .lp-col-span-2 { grid-column: span 2 / span 2; }
          .lp-nav-desktop { display: flex !important; }
          .lp-nav-mobile { display: none !important; }
          .lp-hero-section { padding-top: 8rem; padding-bottom: 6rem; }
          .lp-hero-heading { font-size: 3.75rem; }
          .lp-section-heading { font-size: 3rem; }
          .lp-mobile-menu { display: none !important; }
          .lp-feature-grid { grid-template-columns: repeat(3, 1fr); }
          .lp-footer-bottom { flex-direction: row; }
        }
        @media (min-width: 1024px) {
          .lp-pricing-grid { grid-template-columns: repeat(3, 1fr); }
          .lp-testimonial-grid { grid-template-columns: repeat(2, 1fr); }
          .lp-hero-heading { font-size: 4.5rem; }
          .lp-footer-grid { grid-template-columns: repeat(5, 1fr); }
        }
      `}</style>
      <div className="min-h-screen bg-[#050a18] text-white relative overflow-hidden selection:bg-indigo-500/30">
      <MagicalSparkles />

      {/* INTRO PRELOADER */}
      <AnimatePresence>
        {showIntro && <IntroPreloader onDone={() => setShowIntro(false)} />}
      </AnimatePresence>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050a18]/60 backdrop-blur-2xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <motion.a href="/" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-[1px] shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-[#0a1128] backdrop-blur rounded-[10px] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
              </div>
              <span className="text-lg font-bold tracking-tight text-white">
                Shiromani Printers
              </span>
            </motion.a>

            <div className="lp-nav-desktop items-center gap-2">
              {["Features", "Pricing", "FAQ"].map((label) => (
                <a key={label} href={`#${label.toLowerCase()}`} className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-all duration-300">
                  {label}
                </a>
              ))}
              <div className="w-px h-6 bg-white/10 mx-3" />
              <button onClick={() => go("/login")} className="text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 rounded-full px-5 py-2.5 bg-transparent border-0 cursor-pointer transition-all">Login</button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <button onClick={() => go("/register")}
                  className="ml-2 bg-white text-black hover:bg-gray-200 font-semibold px-6 h-10 rounded-full shadow-2xl shadow-white/10 transition-all border-0 cursor-pointer flex items-center">
                  Start Free <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </motion.div>
            </div>

            <div className="lp-nav-mobile items-center gap-2">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="rounded-full text-white bg-transparent border-0 cursor-pointer p-2 hover:bg-white/10 transition-all">
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>

            {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, y: -20, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="lp-mobile-menu absolute top-20 left-0 right-0 bg-[#0a1128]/95 backdrop-blur-3xl border-b border-white/10 p-6 shadow-2xl shadow-black/50">
              {["Features", "Pricing", "FAQ"].map((label) => (
                <a key={label} href={`#${label.toLowerCase()}`} onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-base font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl">{label}</a>
              ))}
              <div className="pt-4 mt-2 border-t border-white/10 flex flex-col gap-3">
                <button className="h-12 text-base rounded-xl w-full border border-white/10 text-white bg-transparent cursor-pointer transition-all hover:bg-white/5" onClick={() => go("/login")}>Login</button>
                <button className="h-12 text-base rounded-xl w-full bg-white text-black border-0 cursor-pointer font-semibold hover:bg-gray-200 transition-all" onClick={() => go("/register")}>Start Free</button>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      <main className="pt-32">
        {/* ═══════ HERO SECTION — LOOPING SCENES ═══════ */}
        <section className="lp-hero-section relative text-center overflow-hidden min-h-[95vh] flex flex-col justify-center">

          {/* Animated Ambient Orbs */}
          <motion.div
            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.15, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-amber-500/15 via-fuchsia-500/15 to-indigo-500/15 blur-[120px] rounded-full pointer-events-none z-0"
          />
          <motion.div
            animate={{ opacity: [0.15, 0.35, 0.15], x: [-50, 50, -50] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none z-0"
          />

          {/* Scene Indicator Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
            {HERO_SCENES.map((_, i) => (
              <button key={i} onClick={() => setCurrentScene(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${i === currentScene ? "bg-white w-8" : "bg-white/30 hover:bg-white/50"}`} />
            ))}
          </div>

          <div className="relative z-10 lp-content-center w-full">

            {/* Text Container — Animates on scene change */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScene}
                initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -30, filter: "blur(8px)" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center"
              >
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 backdrop-blur-md text-indigo-400 text-sm font-semibold mb-8 shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)]">
                  <BadgeCheck className="w-4 h-4" />
                  {scene.badge}
                </div>

                <h1 className="lp-hero-heading font-black tracking-tight leading-[1.1] mb-6 max-w-4xl text-balance text-white drop-shadow-2xl">
                  {scene.heading}
                </h1>

                <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-10 leading-relaxed font-medium text-balance drop-shadow-lg">
                  {scene.sub}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full mb-10">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <button onClick={() => go("/register")}
                      className="bg-white text-black hover:bg-gray-200 font-bold text-lg px-10 h-14 rounded-full shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)] transition-all border-0 cursor-pointer flex items-center">
                      Start Building Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <button className="text-lg font-semibold h-14 px-10 rounded-full border border-white/20 text-white hover:bg-white/10 backdrop-blur-sm transition-all bg-transparent cursor-pointer">
                      View Demo
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Visual Container — Changes per scene (desktop only) */}
            <div className="hidden md:block">
              <AnimatePresence mode="wait">
                {scene.visual === "dashboard" && <DashboardVisual key="dash" />}
                {scene.visual === "features" && <FeaturesVisual key="feat" />}
                {scene.visual === "trust" && <TrustVisual key="trust" />}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="lp-section relative w-full flex flex-col items-center">
          <div className="lp-content-center w-full">
            <div className="flex flex-col items-center text-center lp-mb-20">
              <motion.div {...FADE_UP(0)}>
                <p className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-4">Core Infrastructure</p>
                <h2 className="lp-section-heading font-extrabold tracking-tight mb-6">
                  Precision-Engineered Tools
                </h2>
                <p className="text-xl text-gray-400 max-w-2xl text-balance">
                  From a single shop to a multi-branch enterprise, we provide the industrial-strength capabilities you need.
                </p>
              </motion.div>
            </div>

            <div className="lp-feature-grid">
              {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title} {...FADE_UP(i * 0.1)}>
                  <div className="group relative h-full p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-500 hover:border-indigo-500/30 hover:bg-white/10 hover:shadow-2xl hover:shadow-indigo-500/10 overflow-hidden">
                    <div className="absolute -inset-px bg-gradient-to-b from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500 blur-xl pointer-events-none" />
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-600 p-[1px] mb-6 shadow-lg shadow-indigo-500/25 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                        <div className="w-full h-full bg-[#0e1629] rounded-[15px] flex items-center justify-center">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <h3 className="font-bold text-xl mb-3 tracking-tight">{title}</h3>
                      <p className="text-base text-gray-400 leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* RATINGS BANNER */}
        <section className="lp-section-sm relative overflow-hidden border-y border-white/10 w-full flex flex-col items-center">
           <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-fuchsia-500/10 to-indigo-500/10 backdrop-blur-3xl" />
          <motion.div {...FADE_UP(0)} className="relative z-10 lp-content-center w-full">
            <h3 className="text-2xl font-bold mb-6">Loved by modern entrepreneurs</h3>
            <div className="flex items-center gap-2 mb-4 bg-black/50 px-6 py-3 rounded-full backdrop-blur-md border border-white/10">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-6 h-6 fill-amber-400 text-amber-400" />)}
              </div>
              <span className="ml-3 text-lg font-bold">4.9 / 5.0</span>
            </div>
            <p className="text-base font-medium text-gray-400">Based on 2,800+ verified owner experiences on Google &amp; Play Store</p>
          </motion.div>
        </section>

        {/* TESTIMONIALS */}
        <section className="lp-section bg-white/[0.02] relative w-full flex flex-col items-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 lp-content-center w-full">
            <motion.div {...FADE_UP(0)} className="max-w-3xl mx-auto lp-mb-16 flex flex-col items-center">
              <p className="text-sm font-bold text-fuchsia-500 uppercase tracking-widest mb-4">Wall of Love</p>
              <h2 className="lp-section-heading font-extrabold tracking-tight mb-6">Built for those who demand more</h2>
              <p className="text-xl text-gray-400 mb-8 text-balance">
                Don't just take our word for it. Listen to the thousands of founders who have transformed their operations.
              </p>
              <button className="rounded-full h-12 px-8 text-base font-semibold border border-white/10 text-white hover:bg-white/5 bg-transparent cursor-pointer transition-all">Read all stories</button>
            </motion.div>

            <div className="flex flex-col md:flex-row flex-wrap justify-center gap-6 w-full max-w-5xl">
              {TESTIMONIALS.map(({ name, role, rating, text }, i) => (
                  <motion.div key={name} {...FADE_UP(i * 0.2)} className="relative group w-full md:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
                  <div className="p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-indigo-500/10 text-left h-full flex flex-col">
                    <div className="flex gap-1 mb-6">
                      {[...Array(rating)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-base font-medium leading-relaxed mb-8 flex-1">"{text}"</p>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white text-lg font-bold shadow-lg flex-shrink-0">
                        {name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-white">{name}</div>
                        <div className="text-sm font-medium text-gray-400">{role}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="lp-section relative overflow-hidden w-full flex flex-col items-center">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] h-[500px] bg-gradient-to-r from-indigo-500/20 via-fuchsia-500/20 to-indigo-500/20 blur-[150px] rounded-[100%] pointer-events-none opacity-50" />
           
          <div className="relative z-10 lp-content-center w-full">
            <div className="flex flex-col items-center text-center lp-mb-20 w-full">
              <motion.div {...FADE_UP(0)}>
                <h2 className="lp-section-heading font-extrabold tracking-tight mb-6">Simple, transparent pricing</h2>
                <p className="text-xl text-gray-400">Start free. Scale as you dominate the market.</p>
              </motion.div>
            </div>
            
            <div className="lp-pricing-grid max-w-6xl mx-auto items-center">
              {PLANS.map(({ name, price, period, highlight, features, cta }, i) => (
                <motion.div key={name} {...FADE_UP(i * 0.15)} className={highlight ? "lg:scale-[1.05] z-20" : "z-10"}>
                  <div className={`relative rounded-[2.5rem] border p-10 flex flex-col transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 bg-[#0e1629]/80 backdrop-blur-2xl
                    ${highlight 
                      ? "border-indigo-500/50 shadow-[0_0_50px_-12px_rgba(99,102,241,0.4)] pt-14" 
                      : "border-white/10"}`}>
                    
                    {highlight && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-600 text-white text-sm font-bold shadow-xl shadow-indigo-500/30 whitespace-nowrap">
                        Most Popular Choice
                      </div>
                    )}
                    
                    <div className="mb-8">
                      <h3 className="font-bold text-xl mb-3">{name}</h3>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-black tracking-tight ${highlight ? "bg-gradient-to-br from-indigo-500 to-fuchsia-600 bg-clip-text text-transparent" : "text-white"}`}>
                          {price}
                        </span>
                        <span className="text-gray-400 font-medium">{period}</span>
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-white/10 mb-8" />
                    
                    <ul className="space-y-4 flex-1 mb-10">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-3 text-base font-medium">
                          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${highlight ? "text-indigo-500" : "text-gray-500"}`} />
                          <span className={highlight ? "text-white" : "text-gray-400"}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <button
                        onClick={() => go("/register")}
                        className={`w-full rounded-2xl h-14 text-base font-bold transition-all border-0 cursor-pointer ${
                          highlight 
                            ? "bg-white text-black shadow-xl hover:bg-gray-200" 
                            : "bg-white/10 text-white hover:bg-white/15 border border-white/5"
                        }`}
                      >
                        {cta}
                      </button>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="lp-section bg-white/[0.02] border-t border-white/5 w-full flex flex-col items-center">
          <div className="lp-content-center w-full" style={{ maxWidth: '64rem' }}>
            <div className="flex flex-col items-center text-center lp-mb-16 w-full">
              <motion.div {...FADE_UP(0)}>
                <h2 className="lp-section-heading font-bold tracking-tight">Everything you need to know</h2>
              </motion.div>
            </div>
            <motion.div {...FADE_UP(0.2)}>
              <div className="space-y-4">
                {FAQS.map(({ q, a }, i) => (
                  <details key={i}
                    className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-8 transition-all duration-300 group open:border-indigo-500/40 open:bg-indigo-500/5">
                    <summary className="text-left text-lg font-semibold py-6 text-white cursor-pointer list-none flex items-center justify-between hover:text-indigo-300 transition-colors">
                      {q}
                      <span className="text-gray-500 text-xl ml-4 transition-transform duration-300 group-open:rotate-45">+</span>
                    </summary>
                    <div className="text-base text-gray-400 pb-6 leading-relaxed">{a}</div>
                  </details>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA */}
        <section className="lp-section relative w-full flex flex-col items-center">
          <div className="lp-content-center w-full" style={{ maxWidth: '72rem' }}>
            <motion.div {...FADE_UP(0)}>
              <div className="relative rounded-[3rem] overflow-hidden border border-white/10 bg-[#0e1629]/50 backdrop-blur-2xl p-16 md:p-24 text-center shadow-2xl">
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/20 via-transparent to-fuchsia-500/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-indigo-500/10 to-transparent blur-[80px]" />
                
                <h2 className="lp-section-heading font-black mb-6 tracking-tight drop-shadow-sm">Ready to level up?</h2>
                <p className="text-xl md:text-2xl font-medium text-gray-400 mb-12 max-w-2xl mx-auto text-balance">
                  Join 10,000+ top-tier businesses already commanding their operations with Shiromani Printers.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <button onClick={() => go("/register")}
                      className="bg-white text-black font-bold text-xl px-12 h-16 rounded-full shadow-2xl transition-all hover:bg-gray-200 border-0 cursor-pointer flex items-center">
                      Start For Free <ArrowRight className="ml-3 h-6 w-6" />
                    </button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/10 bg-[#050a18] pt-24 pb-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="lp-footer-grid gap-12 lp-mb-20 text-left">
            <div className="lp-col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-black" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white">Shiromani Printers</span>
              </div>
              <p className="text-base text-gray-400 max-w-sm leading-relaxed mb-8">
                The modern standard for Indian invoicing, designed for speed, beauty, and absolute precision.
              </p>
            </div>
            {[
              { heading: "Product",  links: ["Features", "Pricing", "API access", "Integrations"] },
              { heading: "Resources", links: ["Documentation", "Guides", "Blog", "Changelog"] },
              { heading: "Company",  links: ["About Us", "Careers", "Legal", "Contact"] },
            ].map(({ heading, links }) => (
              <div key={heading} className="col-span-1 md:col-span-1">
                <h4 className="text-base font-bold mb-6 text-white">{heading}</h4>
                <ul className="space-y-4">
                  {links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm font-medium text-gray-400 hover:text-white hover:underline transition-all">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="lp-footer-bottom border-t border-white/5 pt-8 flex justify-between items-center gap-6">
            <span className="text-sm font-medium text-gray-500">© 2026 Shiromani Printers. All rights reserved.</span>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-500/90">Bank-grade Security · 99.9% Uptime</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  );
}
