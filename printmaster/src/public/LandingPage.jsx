import { useState } from "react";
import {
  Zap, Shield, TrendingUp, FileText, Users, BarChart3,
  Smartphone, CheckCircle2, Menu, X, Moon, Sun, ArrowRight,
  Star, BadgeCheck, Package, CreditCard, Receipt,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { useTheme } from "../components/ThemeProvider";
import { motion } from "framer-motion";

const FEATURES = [
  { icon: Receipt,    title: "GST Invoicing",      desc: "Generate fully compliant GST invoices in seconds. Auto-calculate taxes across all GST slabs with zero effort." },
  { icon: Package,    title: "Inventory Control",   desc: "Real-time stock tracking, low-stock alerts, and batch management — never run out or overstock again." },
  { icon: TrendingUp, title: "Business Analytics",  desc: "Live dashboards with profit, revenue, and expense breakdowns. Understand your business at a glance." },
  { icon: CreditCard, title: "Payment Tracking",    desc: "Record payments, send reminders, and reconcile dues. Collect what you're owed, faster." },
  { icon: Users,      title: "Multi-User Access",   desc: "Invite your team with role-based permissions. Everyone gets exactly what they need." },
  { icon: Smartphone, title: "Mobile-First",        desc: "Full-featured Android and iOS apps. Manage billing, inventory, and reports from anywhere." },
];

const STATS = [
  { value: "10,000+",  label: "Businesses Served" },
  { value: "₹500Cr+",  label: "Invoices Processed" },
  { value: "99.9%",    label: "Uptime Guarantee" },
  { value: "< 8 sec",  label: "Invoice Creation" },
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

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, delay },
});

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const go = (path) => { try { window.location.href = path; } catch { window.location.assign(path); } };

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 backdrop-blur-xl bg-background/80 h-20">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
            <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-[15px] font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
                Shiromani Printers
              </span>
            </a>

            <div className="hidden md:flex items-center gap-1">
              {[["#features","Features"],["#pricing","Pricing"],["#faq","FAQ"]].map(([h,l]) => (
                <a key={h} href={h} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">{l}</a>
              ))}
              <div className="w-px h-5 bg-border mx-2" />
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full h-9 w-9">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => go("/login")} className="text-sm">Login</Button>
              <Button size="sm" onClick={() => go("/register")}
                className="ml-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 shadow-md shadow-indigo-500/20 text-white text-sm rounded-lg">
                Start Free <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex md:hidden items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9 rounded-full">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>

            {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              className="md:hidden py-4 space-y-1 border-t border-border/60">
              {[["#features","Features"],["#pricing","Pricing"],["#faq","FAQ"]].map(([h,l]) => (
                <a key={h} href={h} onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent">{l}</a>
              ))}
              <div className="pt-2 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => go("/login")}>Login</Button>
                <Button size="sm" className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 text-white" onClick={() => go("/register")}>Start Free</Button>
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      <main className="pt-32">
        {/* HERO */}
        <section className="pt-24 pb-20 text-center">
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex flex-col items-center">
              <motion.div {...fadeUp(0)}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/8 text-indigo-500 text-xs font-medium mb-8">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  GST-Ready · Trusted by 10,000+ Businesses
                </div>
              </motion.div>

              <motion.h1 {...fadeUp(0.1)}
                className="mt-6 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-6 max-w-4xl">
                The smartest way to{" "}
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 bg-clip-text text-transparent">
                  run your business
                </span>
              </motion.h1>

              <motion.p {...fadeUp(0.2)}
                className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
                Professional invoicing, real-time inventory, and seamless GST compliance — all in one elegant platform built for Indian businesses.
              </motion.p>

              <motion.div {...fadeUp(0.3)} className="flex flex-col sm:flex-row gap-3 items-center justify-center mb-16 w-full">
                <Button size="lg" onClick={() => go("/register")}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white text-base px-8 h-12 shadow-xl shadow-indigo-500/25 rounded-xl">
                  Start Free — No Card Required
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="text-base h-12 px-8 rounded-xl border-border/70 hover:border-indigo-500/40">
                  Book a Demo
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div {...fadeUp(0.4)} className="w-full max-w-5xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  {STATS.map(({ value, label }) => (
                    <div key={label} className="px-6 py-5 text-center rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm">
                      <div className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">{value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <motion.div {...fadeUp()}>
                <p className="text-sm font-semibold text-indigo-500 uppercase tracking-widest mb-3">Everything You Need</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                  Built for the way India does business
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  From a single shop to a multi-branch enterprise, every tool you need is right here.
                </p>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <motion.div key={title} {...fadeUp(i * 0.08)}>
                  <div className="group h-full p-6 rounded-2xl border border-border/60 bg-card/50 hover:border-indigo-500/40 hover:bg-card transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 group-hover:from-indigo-500/25 group-hover:to-violet-500/25 flex items-center justify-center mb-4 transition-all">
                      <Icon className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold text-base mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* RATINGS BANNER */}
        <section className="py-14 border-y border-border/40 bg-gradient-to-r from-indigo-500/4 via-violet-500/4 to-indigo-500/4">
          <div className="max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
            <div className="flex items-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 text-sm font-semibold">4.9 / 5.0</span>
            </div>
            <p className="text-sm text-muted-foreground">Rated by 2,800+ verified business owners on Google &amp; Play Store</p>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <motion.div {...fadeUp()}>
                <p className="text-sm font-semibold text-indigo-500 uppercase tracking-widest mb-3">Testimonials</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Businesses love us</h2>
              </motion.div>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map(({ name, role, rating, text }, i) => (
                <motion.div key={name} {...fadeUp(i * 0.1)}>
                  <div className="h-full p-6 rounded-2xl border border-border/60 bg-card/50 flex flex-col">
                    <div className="flex gap-0.5 mb-4">
                      {[...Array(rating)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">"{text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{name}</div>
                        <div className="text-xs text-muted-foreground">{role}</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-20 bg-gradient-to-b from-transparent via-secondary/8 to-transparent">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <motion.div {...fadeUp()}>
                <p className="text-sm font-semibold text-indigo-500 uppercase tracking-widest mb-3">Pricing</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
                <p className="text-lg text-muted-foreground">Start free. Scale as you grow.</p>
              </motion.div>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {PLANS.map(({ name, price, period, highlight, features, cta }, i) => (
                <motion.div key={name} {...fadeUp(i * 0.1)}>
                  <div className={`relative h-full rounded-2xl border p-8 flex flex-col ${
                    highlight
                      ? "border-indigo-500/60 bg-gradient-to-b from-indigo-500/8 to-violet-500/5 shadow-2xl shadow-indigo-500/15"
                      : "border-border/60 bg-card/50"
                  }`}>
                    {highlight && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-xs font-semibold shadow-lg whitespace-nowrap">
                        Most Popular
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="font-bold text-lg mb-1">{name}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-4xl font-extrabold ${highlight ? "bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent" : ""}`}>
                          {price}
                        </span>
                        <span className="text-muted-foreground text-sm">{period}</span>
                      </div>
                    </div>
                    <ul className="space-y-3 flex-1 mb-8">
                      {features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => go("/register")}
                      variant={highlight ? "default" : "outline"}
                      className={`w-full rounded-xl h-11 ${highlight ? "bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white shadow-lg shadow-indigo-500/20" : "border-border/70"}`}
                    >
                      {cta}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex flex-col items-center text-center mb-12">
              <motion.div {...fadeUp()}>
                <p className="text-sm font-semibold text-indigo-500 uppercase tracking-widest mb-3">FAQ</p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Common questions</h2>
              </motion.div>
            </div>
            <Accordion type="single" collapsible className="space-y-3">
              {FAQS.map(({ q, a }, i) => (
                <motion.div key={i} {...fadeUp(i * 0.07)}>
                  <AccordionItem value={`item-${i}`}
                    className="bg-card border border-border/60 rounded-2xl px-6 data-[state=open]:border-indigo-500/40 transition-colors">
                    <AccordionTrigger className="text-left hover:no-underline text-sm font-medium py-5">{q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground pb-5 leading-relaxed">{a}</AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <motion.div {...fadeUp()}>
              <div className="relative rounded-3xl overflow-hidden border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-card to-violet-500/10 p-12 text-center">
                <div className="absolute inset-0 -z-10 pointer-events-none">
                  <div className="absolute top-0 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/8 text-indigo-500 text-xs font-medium mb-6">
                  <Zap className="w-3.5 h-3.5" />
                  Free to start, no credit card needed
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Ready to grow your business?</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                  Join 10,000+ businesses already billing smarter with Shiromani Printers.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <Button size="lg" onClick={() => go("/register")}
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white text-base px-8 h-12 rounded-xl shadow-xl shadow-indigo-500/25">
                    Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="text-base h-12 px-8 rounded-xl border-border/70">
                    Schedule Demo
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">Shiromani Printers</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                India's most trusted billing and inventory platform. Built for small businesses, loved by growing enterprises.
              </p>
            </div>
            {[
              { heading: "Product",  links: ["Features", "Pricing", "Mobile App", "Integrations"] },
              { heading: "Company",  links: ["About Us", "Blog", "Careers", "Contact"] },
              { heading: "Legal",    links: ["Privacy Policy", "Terms of Service", "Security"] },
            ].map(({ heading, links }) => (
              <div key={heading}>
                <h4 className="text-sm font-semibold mb-4">{heading}</h4>
                <ul className="space-y-2.5">
                  {links.map((l) => (
                    <li key={l}><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border/50 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
            <span>© 2026 Shiromani Printers. All rights reserved.</span>
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3" /> GST Compliant · ISO 27001 Aligned · 99.9% Uptime</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
