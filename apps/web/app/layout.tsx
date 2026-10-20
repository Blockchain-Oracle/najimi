import { APP } from "@najimi/config"
import { env } from "@najimi/env/server"
import { cn } from "@najimi/ui/lib/utils"
import type { Metadata, Viewport } from "next"
import { Antonio, Inter } from "next/font/google"
import { Providers } from "./providers"
import "./globals.css"

// The design lock's faces (context/design/README.md): Inter for every UI size (DICE lists it as
// Favorit's substitute) and Antonio 700 for poster titles only (Foggy's substitute). Both OFL.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const antonio = Antonio({ subsets: ["latin"], weight: ["700"], variable: "--font-antonio" })

export const metadata: Metadata = {
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: { default: `${APP.name} — ${APP.tagline}`, template: `%s · ${APP.name}` },
  description: APP.description,
  applicationName: APP.name,
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn(inter.variable, antonio.variable)} suppressHydrationWarning>
      <body className="min-h-svh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
