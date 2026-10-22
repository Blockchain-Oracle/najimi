import { APP } from "@najimi/config"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { pageLocale } from "@/lib/page-locale"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

/** Someone who already has a taste goes back to it; everyone else starts. */
async function MainAction({ start, open }: { start: string; open: string }) {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  return (
    <Link
      href={self ? `/people/${self.id}` : "/start"}
      className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      {self ? open : start} <ArrowRight className="size-4 rtl:rotate-180" />
    </Link>
  )
}

/** The front door: what Najimi is, and one way in. The full landing comes with the launch stage. */
export default async function Landing({ params }: PageProps<"/[locale]">) {
  await pageLocale(params)
  const t = await getTranslations("Landing")
  return (
    <main className="flex min-h-svh w-full flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <span className="font-title text-[22px]">{APP.name.toLowerCase()}</span>
        <LanguageMenu />
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-7 px-6 py-14">
        <p className="font-mono text-xs text-text-3">{t("kicker")}</p>
        <h1 className="font-title text-hero max-w-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-text-2">{t("lede")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Suspense
            fallback={
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground"
              >
                {t("start")} <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            <MainAction start={t("start")} open={t("continue")} />
          </Suspense>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-text-3">
        <span>{t("footer")}</span>
        <span>{t("builtOn")}</span>
      </footer>
    </main>
  )
}
