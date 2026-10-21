import { APP } from "@najimi/config"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { LanguageMenu } from "@/components/language-menu"
import { pageLocale } from "@/lib/page-locale"

/** Interim landing while the taste copilot is built stage by stage; the real one comes at launch. */
export default async function Landing({ params }: PageProps<"/[locale]">) {
  await pageLocale(params)
  const t = await getTranslations("Landing")
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 pb-16">
      <header className="flex h-16 items-center justify-between">
        <span className="font-title text-xl">{APP.name.toLowerCase()}</span>
        <LanguageMenu />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-8 py-16">
        <h1 className="font-title text-hero max-w-4xl">{t("title")}</h1>
        <p className="max-w-xl text-lg text-text-2">{t("lede")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/start"
            className="rounded-pill bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-sticker transition-transform hover:-translate-y-0.5"
          >
            {t("start")}
          </Link>
          <Link
            href="/me"
            className="text-sm font-semibold underline underline-offset-4 decoration-foreground/30"
          >
            {t("continue")}
          </Link>
        </div>
        <p className="text-sm text-text-3">{t("coming")}</p>
      </section>
    </main>
  )
}
