"use client"

import { useState } from "react"
import { ThemeProvider } from "@/components/ThemeProvider"
import LoginPage from "@/components/LoginPage"

export default function Login() {
  const [mode, setMode] = useState<"username" | "email">("username")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [form, setForm] = useState({ username: "", password: "" })
  const [emailAuth, setEmailAuth] = useState({
    email: "",
    otp: "",
    step: "enterEmail" as const,
  })

  const handleUsernameLogin = async () => {
    setLoading(true)
    setErr("")
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setLoading(false)
    // Demo: Show error for demonstration
    if (form.username && form.password) {
      alert("Login successful! (Demo)")
      window.location.href = "/"
    } else {
      setErr("Please enter username and password")
    }
  }

  const handleSendOtp = async () => {
    setLoading(true)
    setErr("")
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setLoading(false)
    if (emailAuth.email) {
      setEmailAuth((s) => ({ ...s, step: "enterOtp" }))
    } else {
      setErr("Please enter your email address")
    }
  }

  const handleVerifyOtp = async () => {
    setLoading(true)
    setErr("")
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setLoading(false)
    if (emailAuth.otp === "123456") {
      alert("OTP verified! (Demo)")
      window.location.href = "/"
    } else {
      setErr("Invalid OTP. Try 123456 for demo.")
    }
  }

  const handleForgotPassword = () => {
    alert("Password reset email sent! (Demo)")
  }

  return (
    <ThemeProvider>
      <LoginPage
        loading={loading}
        err={err}
        mode={mode}
        setMode={setMode}
        form={form}
        setForm={setForm}
        emailAuth={emailAuth}
        setEmailAuth={setEmailAuth}
        onUsernameLogin={handleUsernameLogin}
        onSendOtp={handleSendOtp}
        onVerifyOtp={handleVerifyOtp}
        onForgotPassword={handleForgotPassword}
      />
    </ThemeProvider>
  )
}
