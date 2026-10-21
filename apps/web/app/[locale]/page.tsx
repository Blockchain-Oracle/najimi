import { APP } from "@najimi/config"
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
        <p className="sticker w-fit px-4 py-2 text-sm font-semibold">{t("coming")}</p>
      </section>
    </main>
  )
}
