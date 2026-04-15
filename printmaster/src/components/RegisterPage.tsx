"use client"

import { useMemo, useState } from "react"
import {
  FileText, ArrowRight, ArrowLeft, Check, Zap, Shield, BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { motion, AnimatePresence } from "framer-motion"

const PERKS = [
  { icon: Zap, text: "Create your first invoice in under 60 seconds" },
  { icon: Shield, text: "Bank-grade security with daily encrypted backups" },
  { icon: BarChart3, text: "Live reports, GST returns, and insights built in" },
]

interface RegisterPageProps {
  loading?: boolean
  onSubmit?: (data: FormData) => void
}

interface FormData {
  organisationName: string
  shopName: string
  address: string
  phone: string
  adminName: string
  adminEmail: string
  adminUsername: string
  adminPassword: string
}

export default function RegisterPage({ loading = false, onSubmit }: RegisterPageProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    organisationName: "",
    shopName: "",
    address: "",
    phone: "",
    adminName: "",
    adminEmail: "",
    adminUsername: "",
    adminPassword: "",
  })

  const canGoNext = useMemo(() => {
    if (step === 1) return !!formData.organisationName.trim()
    return (
      !!formData.adminUsername.trim() &&
      !!formData.adminPassword.trim() &&
      !!formData.adminEmail.trim()
    )
  }, [formData, step])

  const update = (field: keyof FormData, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 2) setStep(step + 1)
    else onSubmit?.(formData)
  }

  const pwLen = formData.adminPassword.length
  const strengthLabel = pwLen < 4 ? "Too short" : pwLen < 8 ? "Fair" : "Strong"

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
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h2 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight mb-4">
              Start billing smarter{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
                today
              </span>
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed mb-8">
              Join 10,000+ Indian businesses running on Shiromani. Free to start, scales as you grow.
            </p>

            {/* Feature bullets */}
            <div className="space-y-4">
              {PERKS.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-indigo-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Testimonial card */}
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
          {/* Step Indicator */}
          <div className="flex items-center mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step > 1 ? "bg-green-500 text-white" : "bg-indigo-500 text-white"
                }`}>
                {step > 1 ? <Check className="w-4 h-4" /> : "1"}
              </div>
              <span className="text-sm font-medium">Organisation</span>
            </div>
            <div className="flex-1 h-px mx-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? "bg-indigo-500 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                2
              </div>
              <span className="text-sm font-medium">Account</span>
            </div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {step === 1 ? "Tell us about your business" : "Set up your admin account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === 1 ? "This helps personalise your invoices and reports." : "You can invite more team members later."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleNext} className="space-y-4">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="s1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="orgName">
                      Organisation Name <span className="text-indigo-500">*</span>
                    </Label>
                    <Input
                      id="orgName"
                      placeholder="e.g. ABC Traders Pvt. Ltd."
                      value={formData.organisationName}
                      onChange={(e) => update("organisationName", e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shopName" className="text-muted-foreground">
                      Shop / Brand Name <span className="text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="shopName"
                      placeholder="Display name on invoices"
                      value={formData.shopName}
                      onChange={(e) => update("shopName", e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="text-muted-foreground">
                      Address <span className="text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="address"
                      placeholder="Business address for invoices"
                      value={formData.address}
                      onChange={(e) => update("address", e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-muted-foreground">
                      Phone <span className="text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      placeholder="+91 98000 00000"
                      value={formData.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      className="h-11"
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="s2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="adminName" className="text-muted-foreground">
                      Full Name <span className="text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="adminName"
                      placeholder="Your full name"
                      value={formData.adminName}
                      onChange={(e) => update("adminName", e.target.value)}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">
                      Email Address <span className="text-indigo-500">*</span>
                    </Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.adminEmail}
                      onChange={(e) => update("adminEmail", e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminUsername">
                      Username <span className="text-indigo-500">*</span>
                    </Label>
                    <Input
                      id="adminUsername"
                      placeholder="Choose a login username"
                      value={formData.adminUsername}
                      onChange={(e) => update("adminUsername", e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminPassword">
                      Password <span className="text-indigo-500">*</span>
                    </Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      placeholder="Min. 4 characters"
                      value={formData.adminPassword}
                      onChange={(e) => update("adminPassword", e.target.value)}
                      required
                      className="h-11"
                    />
                    {pwLen > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex gap-1 flex-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all ${pwLen > i * 2
                                ? pwLen >= 8
                                  ? "bg-green-500"
                                  : "bg-indigo-500"
                                : "bg-border"
                                }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{strengthLabel}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading || !canGoNext}
                className="flex-1 h-11 bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90 disabled:opacity-40 text-white"
              >
                {step === 2 ? (
                  loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating account
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Create Account <Check className="w-4 h-4" />
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-2">
                    Next Step <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>
          </form>

          {/* Footer links */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <a href="/login" className="text-indigo-500 hover:underline font-medium">
              Sign in
            </a>
          </div>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            By creating an account you agree to our{" "}
            <a href="#" className="hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="hover:underline">Privacy Policy</a>.
          </p>
        </div>

      </div>
    </div>
  )
}
