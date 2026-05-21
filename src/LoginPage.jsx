import { useState } from "react";
import {
  FileText,
  Moon,
  Sun,
  Mail,
  User,
  Lock,
  CheckCircle2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useTheme } from "../components/ThemeProvider";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const [loginType, setLoginType] = useState("username");

  const go = (path) => {
    try {
      window.location.href = path;
    } catch {
      window.location.assign(path);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    console.log("Login submitted");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex">
      {/* Left Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <button
            type="button"
            onClick={() => go("/login")}
            className="flex items-center gap-2 mb-8"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4F67FF] to-[#7C3AED] flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] bg-clip-text text-transparent">
              Shiromani Printers
            </span>
          </button>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-8 backdrop-blur-xl bg-card/80 border-border">
              <div className="mb-6">
                <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to your account to continue
                </p>
              </div>

              <Tabs
                value={loginType}
                onValueChange={(v) => setLoginType(v)}
                className="mb-6"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="username">Username</TabsTrigger>
                  <TabsTrigger value="otp">Email OTP</TabsTrigger>
                </TabsList>

                {/* Username/password */}
                <TabsContent value="username" className="space-y-4 mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username or Email</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="username"
                          placeholder="Enter your username"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                        />
                        <span className="text-muted-foreground">
                          Remember me
                        </span>
                      </label>
                      <button
                        type="button"
                        className="text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] hover:opacity-90"
                    >
                      Sign In
                    </Button>
                  </form>
                </TabsContent>

                {/* Email OTP */}
                <TabsContent value="otp" className="space-y-4 mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] hover:opacity-90"
                    >
                      Send OTP
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      We'll send a one-time password to your email
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  Don&apos;t have an account?{" "}
                </span>
                <button
                  type="button"
                  onClick={() => go("/register")}
                  className="text-primary hover:underline font-medium"
                >
                  Register here
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

      {/* Right Side - Hero Illustration */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#4F67FF]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7C3AED]/20 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="max-w-lg"
        >
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
              <Zap className="w-4 h-4" />
              <span>Trusted by 10,000+ businesses</span>
            </div>
            <h2 className="text-4xl font-bold mb-4">
              Manage your business with{" "}
              <span className="bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] bg-clip-text text-transparent">
                confidence
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Join thousands of businesses using PrintMaster Pro for seamless
              billing and inventory management.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-4">
            {[
              {
                icon: CheckCircle2,
                title: "GST Compliant",
                description: "Generate GST-compliant invoices",
              },
              {
                icon: TrendingUp,
                title: "Real-time Reports",
                description: "Track sales and inventory in real-time",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Create invoices in under 30 seconds",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
              >
                <Card className="p-4 backdrop-blur-xl bg-card/50 border-border">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4F67FF]/20 to-[#7C3AED]/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-8">
            {[
              { value: "10K+", label: "Users" },
              { value: "1M+", label: "Invoices" },
              { value: "99.9%", label: "Uptime" },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl font-bold bg-gradient-to-r from-[#4F67FF] to-[#7C3AED] bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}