"use client"

import { ThemeProvider } from "@/components/ThemeProvider"
import LandingPage from "@/components/LandingPage"

export default function Home() {
  return (
    <ThemeProvider>
      <LandingPage />
    </ThemeProvider>
  )
}
