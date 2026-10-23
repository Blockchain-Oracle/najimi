import type { Metadata, Viewport } from "next"
import { Funnel_Display, Funnel_Sans, Geist_Mono } from "next/font/google"
import { Provider } from "@/components/provider"
import { OG, SITE } from "@/lib/site"
import "./global.css"

// The app's faces ("Your taste is the colour"): Funnel Display for titles, Funnel Sans for
// reading, Geist Mono for what the agent did (its steps, its Qloo calls) and for code.
const display = Funnel_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
  variable: "--font-funnel-display",
})
const sans = Funnel_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-funnel-sans",
})
const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.title}` },
  description: SITE.description,
  applicationName: SITE.title,
  openGraph: {
    siteName: SITE.title,
    type: "website",
    images: [{ url: "/og/home.png", width: OG.width, height: OG.height }],
  },
  twitter: { card: "summary_large_image" },
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
      className={`${display.variable} ${sans.variable} ${mono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
