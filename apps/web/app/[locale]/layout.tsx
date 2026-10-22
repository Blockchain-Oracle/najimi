import { APP, DEFAULT_LOCALE } from "@najimi/config"
import { env } from "@najimi/env/server"
import { cn } from "@najimi/ui/lib/utils"
import type { Metadata, Viewport } from "next"
import {
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Instrument_Serif,
} from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getTranslations } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { dirOf, isLocale } from "@/lib/i18n"
import { pageLocale } from "@/lib/page-locale"
import { Providers } from "../providers"
import "../globals.css"

// Darkroom's faces: Instrument Serif for what a page is and what a person said about themselves,
// IBM Plex Sans for everything you read and tap, Plex Mono for what the machine measured, and
// Plex Sans Arabic for Arabic (fetched only when Arabic text appears, by unicode-range).
const serif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
})
const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
})
const plex = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
})
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-arabic",
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
  themeColor: "#0d0c0b",
  colorScheme: "dark",
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await pageLocale(params)
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={cn("dark", serif.variable, plex.variable, mono.variable, plexArabic.variable)}
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
