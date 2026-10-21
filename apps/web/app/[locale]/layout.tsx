import { APP, DEFAULT_LOCALE } from "@najimi/config"
import { env } from "@najimi/env/server"
import { cn } from "@najimi/ui/lib/utils"
import type { Metadata, Viewport } from "next"
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google"
import { NextIntlClientProvider } from "next-intl"
import { getTranslations } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { dirOf, isLocale } from "@/lib/i18n"
import { pageLocale } from "@/lib/page-locale"
import { Providers } from "../providers"
import "../globals.css"

// The OurSpaces faces: Bricolage Grotesque for titles, IBM Plex Sans for everything you read,
// and Plex Sans Arabic for Arabic (fetched only when Arabic text appears, by unicode-range).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext", "vietnamese"],
  variable: "--font-bricolage",
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
  themeColor: "#0b0b0e",
  colorScheme: "dark light",
}

export default async function RootLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = await pageLocale(params)
  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={cn("dark", bricolage.variable, plex.variable, plexArabic.variable)}
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
