import { APP, DEFAULT_LOCALE } from "@najimi/config"
import { env } from "@najimi/env/server"
import { cn } from "@najimi/ui/lib/utils"
import type { Metadata, Viewport } from "next"
import { Funnel_Display, Funnel_Sans, Geist_Mono, Readex_Pro } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getTranslations } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { dirOf, isLocale } from "@/lib/i18n"
import { pageLocale } from "@/lib/page-locale"
import { Providers } from "../providers"
import "../globals.css"

// "Your taste is the colour" (context/11-design): Funnel Display for titles, Funnel Sans for
// everything you read and tap, Geist Mono for what the agent did (its steps and Qloo calls), and
// Readex Pro for Arabic (fetched only when Arabic text appears, by unicode-range).
const display = Funnel_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
  variable: "--font-funnel-display",
})
const sans = Funnel_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-funnel-sans",
})
const mono = Geist_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
})
const arabic = Readex_Pro({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-readex",
  preload: false,
})

export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }))

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale: raw } = await params
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE
  const t = await getTranslations({ locale, namespace: "Meta" })
  return {
    metadataBase: new URL(env.BETTER_AUTH_URL),
    title: { default: `${APP.name} — ${t("tagline")}`, template: `%s · ${APP.name}` },
    description: t("description"),
    applicationName: APP.name,
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await pageLocale(params)
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={cn(display.variable, sans.variable, mono.variable, arabic.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-svh">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
