import { useState } from "react";
import {
  FileText,
  Moon,
  Sun,
  Building2,
  Mail,
  User,
  Phone,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { useTheme } from "../components/ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

export default function RegisterPage() {
  const { theme, toggleTheme } = useTheme();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    gstNumber: "",
    adminName: "",
    adminEmail: "",
    adminPhone: "",
    password: "",
  });

  const go = (path) => {
    try {
      window.location.href = path;
    } catch {
      window.location.assign(path);
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (step < 2) {
      setStep(step + 1);
    } else {
      console.log("Registration submitted", formData);
    }
  };

  const handleBack = () => setStep(step - 1);

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <button
          type="button"
          onClick={() => go("/login")}
          className="flex items-center gap-2 mb-8 justify-center"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F67FF] to-[#7C3AED] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] bg-clip-text text-transparent">
            Shiromani Printers
          </span>
        </button>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            {[1, 2].map((num) => (
              <div key={num} className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                      step >= num
                        ? "bg-gradient-to-br from-[#4F67FF] to-[#7C3AED] text-white"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {step > num ? <Check className="w-5 h-5" /> : num}
                  </div>
                  <div className="text-sm hidden sm:block">
                    <div
                      className={`font-medium ${
                        step >= num
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {num === 1 ? "Organisation" : "Admin Details"}
                    </div>
                  </div>
                </div>
                {num < 2 && (
                  <div
                    className={`w-16 h-0.5 ${
                      step > num
                        ? "bg-gradient-to-r from-[#4F67FF] to-[#7C3AED]"
                        : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 backdrop-blur-xl bg-card/80 border-border">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-2">
                {step === 1 ? "Organisation Details" : "Admin Account"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {step === 1
                  ? "Enter your business information"
                  : "Set up your admin account"}
              </p>
            </div>

            <form onSubmit={handleNext} className="space-y-4">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name *</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="businessName"
                          placeholder="Enter your business name"
                          className="pl-10"
                          value={formData.businessName}
                          onChange={(e) =>
                            updateFormData("businessName", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="businessType">Business Type *</Label>
                      <select
                        id="businessType"
                        className="w-full h-10 px-3 rounded-lg border border-input bg-input-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        value={formData.businessType}
                        onChange={(e) =>
                          updateFormData("businessType", e.target.value)
                        }
                        required
                      >
                        <option value="">Select business type</option>
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="service">Service</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstNumber">GST Number (Optional)</Label>
                      <Input
                        id="gstNumber"
                        placeholder="22AAAAA0000A1Z5"
                        value={formData.gstNumber}
                        onChange={(e) =>
                          updateFormData("gstNumber", e.target.value)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        You can add this later in settings
                      </p>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="adminName">Full Name *</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="adminName"
                          placeholder="Enter your full name"
                          className="pl-10"
                          value={formData.adminName}
                          onChange={(e) =>
                            updateFormData("adminName", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adminEmail">Email Address *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="adminEmail"
                          type="email"
                          placeholder="Enter your email"
                          className="pl-10"
                          value={formData.adminEmail}
                          onChange={(e) =>
                            updateFormData("adminEmail", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adminPhone">Phone Number *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="adminPhone"
                          type="tel"
                          placeholder="Enter your phone number"
                          className="pl-10"
                          value={formData.adminPhone}
                          onChange={(e) =>
                            updateFormData("adminPhone", e.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a strong password"
                        value={formData.password}
                        onChange={(e) =>
                          updateFormData("password", e.target.value)
                        }
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Must be at least 8 characters
                      </p>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-border"
                          required
                        />
                        <span className="text-muted-foreground">
                          I agree to the{" "}
                          <a
                            href="#"
                            className="text-primary hover:underline"
                          >
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a
                            href="#"
                            className="text-primary hover:underline"
                          >
                            Privacy Policy
                          </a>
                        </span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex gap-3 pt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] hover:opacity-90 gap-2"
                >
                  {step === 2 ? "Create Account" : "Next"}
                  {step === 1 && <ArrowRight className="w-4 h-4" />}
                </Button>
              </div>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <button
                type="button"
                onClick={() => go("/login")}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </div>
          </Card>

          {/* Theme Toggle */}
          <div className="mt-6 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="gap-2"
            >
              {theme === "light" ? (
                <>
                  <Moon className="h-4 w-4" />
                  Dark Mode
                </>
              ) : (
                <>
                  <Sun className="h-4 w-4" />
                  Light Mode
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}