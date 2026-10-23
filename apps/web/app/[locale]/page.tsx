import { APP } from "@najimi/config"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { connection } from "next/server"
import { getTranslations } from "next-intl/server"
import { type ReactNode, Suspense } from "react"
import { qlooTag } from "@/components/brands/qloo-logo"
import { GetApp } from "@/components/landing/get-app"
import { type Moment, Moments, WrappedFan } from "@/components/landing/moments"
import { TasteRing } from "@/components/landing/taste-ring"
import { LanguageMenu } from "@/components/language-menu"
import { pageLocale } from "@/lib/page-locale"
import { selfOf } from "@/lib/people"
import { popularLoves } from "@/lib/popular"
import { getSession } from "@/lib/session"

const big = (url: string) =>
  url.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, "-240x-auto.") : url

/** Someone who already has a taste goes to their feed; everyone else starts. */
async function MainAction({
  start,
  open,
  large,
}: {
  start: string
  open: string
  large?: boolean
}) {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  return (
    <Link
      href={self ? "/feed" : "/start"}
      className={
        large
          ? "pointer-events-auto inline-flex h-14 items-center gap-2 rounded-pill bg-foreground px-8 font-heading text-[17px] text-background transition-transform hover:scale-[1.03]"
          : "pointer-events-auto inline-flex h-10 items-center gap-1.5 rounded-pill bg-foreground px-4 text-[14px] font-semibold whitespace-nowrap text-background"
      }
    >
      {self ? open : start} <ArrowRight className="size-4 rtl:rotate-180" />
    </Link>
  )
}

const MOMENTS = [
  ["feed", "/landing/feed.webp"],
  ["city", "/landing/city.webp"],
  ["games", "/landing/game.webp"],
  ["night", "/landing/night.webp"],
  ["business", "/landing/business.webp"],
  ["graph", "/landing/graph.webp"],
] as const

async function Ring({
  headline,
  engine,
  kicker,
  start,
  open,
}: {
  /** The promise, large; then the engine behind it, quieter. */
  headline: string
  engine: string
  kicker: ReactNode
  start: string
  open: string
}) {
  // The ring's artwork is read at request time (kept in memory for hours after).
  await connection()
  const art = (await popularLoves().catch(() => []))
    .flatMap((h) => (h.image ? [{ src: big(h.image), name: h.name }] : []))
    .slice(0, 18)
  return (
    <TasteRing art={art}>
      {/* Few words inside the ring: the promise large, the agent behind it in one quiet line. On a
          phone they stay inside the ring's oval (about 17rem across), so no card covers them. */}
      <div className="pointer-events-none flex w-full max-w-[17rem] flex-col items-center gap-7 text-center md:max-w-2xl md:gap-8">
        <h1 className="flex flex-col items-center gap-3 md:gap-4">
          <span className="max-w-[11ch] font-title text-[2.6rem] leading-[0.98] text-balance md:text-[5.2rem]">
            {headline}
          </span>
          <span className="font-heading text-[1.1rem] leading-snug text-text-2 text-balance md:text-[1.6rem]">
            {engine}
          </span>
        </h1>
        <Suspense fallback={null}>
          <MainAction start={start} open={open} large />
        </Suspense>
        <span className="text-[13px] font-semibold whitespace-nowrap text-text-3">{kicker}</span>
      </div>
    </TasteRing>
  )
}

/** The front door (W27): the promise in a ring of things people love, then the app itself. */
export default async function Landing({ params }: PageProps<"/[locale]">) {
  await pageLocale(params)
  const t = await getTranslations("Landing")
  const moments: Moment[] = MOMENTS.map(([id, image]) => ({
    id,
    image,
    kicker: t(`moments.${id}.kicker`),
    title: t(`moments.${id}.title`),
    chips: [t(`moments.${id}.chip1`), t(`moments.${id}.chip2`)],
  }))
  return (
    <main className="dark relative w-full bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-20 h-24 bg-linear-to-b from-background via-background/70 to-transparent"
      />
      <header className="pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <span className="pointer-events-auto font-title text-[22px]">{APP.name.toLowerCase()}</span>
        <div className="pointer-events-auto flex items-center gap-2">
          <LanguageMenu />
          <Suspense fallback={null}>
            <MainAction start={t("startShort")} open={t("openShort")} />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<div className="h-svh" />}>
        <Ring
          headline={t("headline")}
          engine={t("engine")}
          kicker={t.rich("kicker", qlooTag("ms-0.5 h-[0.95em] text-foreground"))}
          start={t("start")}
          open={t("continue")}
        />
      </Suspense>

      <Moments items={moments} />

      <WrappedFan
        kicker={t("wrapped.kicker")}
        title={t("wrapped.title")}
        slides={["/landing/wrapped-2.webp", "/landing/wrapped-1.webp", "/landing/wrapped-4.webp"]}
      />

      <section className="relative isolate mx-auto flex w-full max-w-5xl flex-col items-center gap-8 overflow-hidden px-6 py-28 text-center">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -z-10 size-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, var(--color-aura-1) 0%, var(--color-aura-2) 45%, transparent 70%)",
          }}
        />
        <h2 className="max-w-[14ch] font-title text-[2.8rem] leading-[1.0] md:text-[4.4rem]">
          {t("closing")}
        </h2>
        <Suspense fallback={null}>
          <MainAction start={t("start")} open={t("continue")} large />
        </Suspense>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-8 text-sm text-text-3">
        <span>{t("footer")}</span>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href="/download"
            className="font-semibold text-text-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:underline"
          >
            {t("getApp")} →
          </Link>
          {APP.docs ? (
            <a
              href={APP.docs}
              className="font-semibold text-text-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:underline"
            >
              {t("docs")}
            </a>
          ) : null}
          <Link
            href="/privacy"
            className="underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("privacy")}
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
            {t("terms")}
          </Link>
        </nav>
        <span className="font-semibold text-text-2">
          {t.rich("builtOn", qlooTag("ms-0.5 h-[0.9em] text-foreground"))}
        </span>
      </footer>
      <GetApp />
    </main>
  )
}
