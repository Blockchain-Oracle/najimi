import type { Metadata, Viewport } from "next"
import { Antonio, Inter } from "next/font/google"
import { Provider } from "@/components/provider"
import "./global.css"

// Interim faces until the taste copilot type lands: Inter for reading, Antonio 700 for titles.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const antonio = Antonio({ subsets: ["latin"], weight: ["700"], variable: "--font-antonio" })

export const metadata: Metadata = {
  title: { default: "Najimi docs", template: "%s · Najimi docs" },
  description: "How Najimi, the taste copilot, uses Qloo to make things that fit you.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${antonio.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
