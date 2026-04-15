"use client"

import { useState } from "react"
import { ThemeProvider } from "@/components/ThemeProvider"
import RegisterPage from "@/components/RegisterPage"

export default function Register() {
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: {
    organisationName: string
    shopName: string
    address: string
    phone: string
    adminName: string
    adminEmail: string
    adminUsername: string
    adminPassword: string
  }) => {
    setLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setLoading(false)
    console.log("Registration data:", data)
    alert("Account created successfully! (Demo)")
    window.location.href = "/login"
  }

  return (
    <ThemeProvider>
      <RegisterPage loading={loading} onSubmit={handleSubmit} />
    </ThemeProvider>
  )
}
