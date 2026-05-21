"use client"

import { useMemo } from "react"
import {
  FileText, CheckCircle2, TrendingUp, Zap, ArrowRight, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { motion } from "framer-motion"

const FEATURES = [
  { icon: CheckCircle2, title: "GST Ready Invoicing", desc: "Generate compliant GST invoices in under 8 seconds." },
  { icon: TrendingUp, title: "Live Business Reports", desc: "Real-time dashboards for sales, expenses, and profit." },
  { icon: BarChart3, title: "Inventory at a Glance", desc: "Track stock levels, alerts, and movements instantly." },
]

interface LoginForm {
  username: string
  password: string
}

interface EmailAuth {
  email: string
  otp: string
  step: "enterEmail" | "enterOtp"
}

interface LoginPageProps {
  brand?: { shopName?: string }
  loading?: boolean
  err?: string
  mode?: "username" | "email"
  setMode?: (mode: "username" | "email") => void
  form?: LoginForm
  setForm?: React.Dispatch<React.SetStateAction<LoginForm>>
  emailAuth?: EmailAuth
  setEmailAuth?: React.Dispatch<React.SetStateAction<EmailAuth>>
  onUsernameLogin?: () => void
  onSendOtp?: () => void
  onVerifyOtp?: () => void
  onForgotPassword?: () => void
}

export default function LoginPage({
  brand,
  loading = false,
  err,
  mode = "username",
  setMode,
  form = { username: "", password: "" },
  setForm,
  emailAuth = { email: "", otp: "", step: "enterEmail" },
  setEmailAuth,
  onUsernameLogin,
  onSendOtp,
  onVerifyOtp,
  onForgotPassword,
}: LoginPageProps) {
  const tabsValue = useMemo(() => (mode === "email" ? "otp" : "username"), [mode])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-background dark:via-background dark:to-background px-6 py-20">
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-12 items-center">

        {/* LEFT SIDE - Marketing Content */}
        <div className="space-y-6">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
              Shiromani Printers
            </span>
          </a>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 text-xs font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              Trusted by 10,000+ businesses
            </div>

            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-4">
              Manage your business with{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
                confidence
              </span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              Seamless billing, inventory management, and GST compliance — everything your business needs in one elegant platform.
            </p>

            {/* Feature bullets */}
            <div className="space-y-3">
              {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonial */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="pt-4">
            <div className="p-4 rounded-2xl border border-indigo-500/20 bg-card/80 shadow-sm">
              <p className="text-sm text-muted-foreground italic leading-relaxed">
                &quot;The best GST billing software I&apos;ve used. Setup was instant and the invoices look very professional.&quot;
              </p>
              <div className="flex items-center gap-3 mt-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold">
                  R
                </div>
                <div>
                  <p className="text-sm font-semibold">Rajesh Gupta</p>
                  <p className="text-xs text-muted-foreground">Owner, Gupta Electronics, Ahmedabad</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* RIGHT SIDE - Form Card */}
        <div className="bg-card shadow-xl rounded-2xl p-8 max-w-md w-full mx-auto border border-border/40">
          {/* Logo (mobile only) */}
          <a href="/" className="flex md:hidden items-center justify-center gap-2.5 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
              {brand?.shopName || "Shiromani Printers"}
            </span>
          </a>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your account to continue</p>
          </div>

          {/* Tabs */}
          <Tabs value={tabsValue} onValueChange={(v) => setMode?.(v === "otp" ? "email" : "username")}>
            <TabsList className="grid w-full grid-cols-2 h-10 rounded-xl bg-secondary/60 p-1 mb-6">
              <TabsTrigger value="username" className="rounded-lg text-sm">Username</TabsTrigger>
              <TabsTrigger value="otp" className="rounded-lg text-sm">Email OTP</TabsTrigger>
            </TabsList>

            {/* Username Tab */}
            <TabsContent value="username">
              <form onSubmit={(e) => { e.preventDefault(); onUsernameLogin?.() }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={form.username}
                    onChange={(e) => setForm?.((s) => ({ ...s, username: e.target.value }))}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={(e) => setForm?.((s) => ({ ...s, password: e.target.value }))}
                    required
                    className="h-11"
                  />
                </div>

                <div className="flex justify-end">
                  <button type="button" className="text-xs text-indigo-500 hover:underline" onClick={onForgotPassword}>
                    Forgot password?
                  </button>
                </div>

                {err && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {err}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4" /></span>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* OTP Tab */}
            <TabsContent value="otp">
              <form onSubmit={(e) => { e.preventDefault(); emailAuth.step === "enterEmail" ? onSendOtp?.() : onVerifyOtp?.() }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={emailAuth.email}
                    onChange={(e) => setEmailAuth?.((s) => ({ ...s, email: e.target.value }))}
                    required
                    className="h-11"
                  />
                </div>

                {emailAuth.step === "enterOtp" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                    <Label htmlFor="otp" className="text-sm font-medium">One-Time Password</Label>
                    <Input
                      id="otp"
                      inputMode="numeric"
                      placeholder="Enter the 6-digit OTP"
                      value={emailAuth.otp}
                      onChange={(e) => setEmailAuth?.((s) => ({ ...s, otp: e.target.value }))}
                      required
                      className="h-11 text-center tracking-[0.3em] text-lg font-mono"
                    />
                    <p className="text-xs text-muted-foreground text-center pt-1">Check your inbox and spam folder</p>
                  </motion.div>
                )}

                {err && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg px-3 py-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    {err}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 text-white">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {emailAuth.step === "enterEmail" ? "Sending OTP" : "Verifying"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {emailAuth.step === "enterEmail" ? "Send OTP" : "Verify OTP"}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

                {emailAuth.step === "enterEmail" && (
                  <p className="text-xs text-center text-muted-foreground">We&apos;ll send a one-time code to your email</p>
                )}
              </form>
            </TabsContent>
          </Tabs>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">New here?</span>
            </div>
          </div>

          {/* Register Link */}
          <a
            href="/register"
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-all"
          >
            Create a free account
          </a>
        </div>

      </div>
    </div>
  )
}
