import { APP } from "@najimi/config"
import { ArrowRight, Clock } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { LanguageMenu } from "@/components/language-menu"
import { pageLocale } from "@/lib/page-locale"

export async function generateMetadata({ params }: PageProps<"/[locale]/demo">): Promise<Metadata> {
  await pageLocale(params)
  const t = await getTranslations("Demo")
  return {
    title: t("title"),
    description: t("lede"),
    openGraph: { images: [{ url: "/demo/cover.png", width: 1920, height: 1080 }] },
  }
}

const STEPS = ["start", "taste", "relight", "share"] as const

/**
 * The demo (T23): the recorded walkthrough when there is one; until then an honest "coming" and
 * the same path to walk yourself, on the live app, in about three minutes.
 */
export default async function DemoPage({ params }: PageProps<"/[locale]/demo">) {
  await pageLocale(params)
  const t = await getTranslations("Demo")
  const video = APP.demoVideo
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-8 px-6 pb-16">
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="font-title text-xl">
          {APP.name.toLowerCase()}
        </Link>
        <LanguageMenu />
      </header>
      <div className="flex flex-col gap-3">
        <h1 className="font-title text-title">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-text-2">{t("lede")}</p>
      </div>

      {video ? (
        <div className="aspect-video overflow-hidden rounded-card bg-black shadow-paper">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video}`}
            title={t("title")}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="size-full"
          />
        </div>
      ) : (
        // On a phone the note sits under the cover; wider, it rests on it.
        <figure className="relative overflow-hidden rounded-card bg-card/5 shadow-paper">
          {/* biome-ignore lint/performance/noImgElement: a static cover from public/ */}
          <img src="/demo/cover.png" alt={t("coverAlt")} className="w-full sm:opacity-60" />
          <figcaption className="flex items-start gap-3 p-4 sm:absolute sm:inset-x-6 sm:bottom-6 sm:rounded-tile sm:bg-background/90 sm:backdrop-blur-sm">
            <Clock className="mt-0.5 size-5 shrink-0 text-lime" />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{t("pendingTitle")}</span>
              <span className="text-sm text-text-2">{t("pendingBody")}</span>
            </span>
          </figcaption>
        </figure>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-title text-title-sm">{t("pathTitle")}</h2>
        <ol className="flex flex-col gap-3">
          {STEPS.map((step, i) => (
            <li
              key={step}
              className="flex gap-4 rounded-card bg-card p-4 text-card-foreground shadow-paper"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lime font-title text-lime-foreground">
                {i + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-semibold">{t(`steps.${step}.title`)}</span>
                <span className="text-[15px] text-paper-muted">{t(`steps.${step}.body`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/start?next=%2Fc%3Fworkflow%3Drelight-my-room"
            className="inline-flex items-center gap-2 rounded-pill bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-sticker transition-transform hover:-translate-y-0.5"
          >
            {t("cta")} <ArrowRight className="size-4 rtl:rotate-180" />
          </Link>
          {APP.docs ? (
            <a
              href={APP.docs}
              className="text-sm font-semibold underline decoration-foreground/30 underline-offset-4"
            >
              {t("docs")}
            </a>
          ) : null}
        </div>
      </section>
    </main>
  )
}
