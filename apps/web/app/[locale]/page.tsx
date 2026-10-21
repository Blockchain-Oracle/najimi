import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { APP } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { cn } from "@najimi/ui/lib/utils"
import { and, desc, eq } from "drizzle-orm"
import { ArrowRight, Heart, Sparkles, Wand2 } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { WORKFLOW_LOOK } from "@/components/workflows/workflow-meta"
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
      className="inline-flex items-center gap-2 rounded-pill bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-sticker transition-transform hover:-translate-y-0.5"
    >
      {self ? open : start} <ArrowRight className="size-4 rtl:rotate-180" />
    </Link>
  )
}

/**
 * Real things Najimi made, drifting past. Only creations marked public (our own showcase, picked
 * by hand) ever appear here; nobody's own work does.
 */
async function Showcase({ label }: { label: string }) {
  const made = await db
    .select({
      id: schema.creations.id,
      title: schema.creations.title,
      words: schema.creations.words,
    })
    .from(schema.creations)
    .where(
      and(
        eq(schema.creations.public, true),
        eq(schema.creations.status, "ready"),
        eq(schema.creations.kind, "image"),
      ),
    )
    .orderBy(desc(schema.creations.createdAt))
    .limit(10)
  if (made.length < 3) return null
  const row = [...made, ...made]
  return (
    <section aria-label={label} className="relative overflow-hidden py-4">
      <div className="flex w-max animate-marquee gap-5 motion-reduce:animate-none hover:[animation-play-state:paused]">
        {row.map((c, i) => (
          <figure
            // biome-ignore lint/suspicious/noArrayIndexKey: the row is the list twice, for a seamless loop
            key={`${c.id}-${i}`}
            aria-hidden={i >= made.length}
            className="print w-72 shrink-0 sm:w-80"
            style={{ rotate: `${((i % 5) - 2) * 0.8}deg` }}
          >
            {/* biome-ignore lint/performance/noImgElement: public showcase renditions from our storage */}
            <img
              src={`/api/media/creation/${c.id}?v=thumb`}
              alt={c.title ?? ""}
              loading="lazy"
              className="aspect-[4/3] w-full rounded-sm object-cover"
            />
            <figcaption className="flex flex-col gap-1.5 px-1 pt-2.5 text-paper-foreground">
              <span className="truncate font-title text-base">{c.title}</span>
              <span className="flex flex-wrap gap-1">
                {c.words.slice(0, 3).map((w) => (
                  <span
                    key={w}
                    className="rounded-pill bg-paper-foreground/7 px-2 py-0.5 text-[11px] font-medium"
                  >
                    {w}
                  </span>
                ))}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

const STEPS = [
  { key: "love", icon: Heart, tone: "bg-pink" },
  { key: "read", icon: Sparkles, tone: "bg-lime" },
  { key: "make", icon: Wand2, tone: "bg-butter" },
] as const

/** The front door (T22): what Najimi is, real things it made, how Qloo powers it, and the workflows. */
export default async function Landing({ params }: PageProps<"/[locale]">) {
  await pageLocale(params)
  const t = await getTranslations("Landing")
  const tw = await getTranslations("Workflows")
  return (
    <main className="flex min-h-svh w-full flex-col pb-16">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <span className="font-title text-xl">{APP.name.toLowerCase()}</span>
        <nav className="flex items-center gap-2">
          <Link
            href="/demo"
            className="rounded-pill px-3 py-1.5 text-sm font-semibold text-text-2 hover:text-foreground"
          >
            {t("demo")}
          </Link>
          <Link
            href="/workflows"
            className="hidden rounded-pill px-3 py-1.5 text-sm font-semibold text-text-2 hover:text-foreground sm:block"
          >
            {tw("title")}
          </Link>
          <LanguageMenu />
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-6 pt-14 pb-10 sm:pt-20">
        <p className="sticker w-fit px-3 py-1 text-xs font-semibold">{t("kicker")}</p>
        <h1 className="font-title text-hero max-w-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-text-2">{t("lede")}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Suspense
            fallback={
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-pill bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-sticker"
              >
                {t("start")} <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            }
          >
            <MainAction start={t("start")} open={t("continue")} />
          </Suspense>
          <a
            href="#workflows"
            className="text-sm font-semibold underline decoration-foreground/30 underline-offset-4"
          >
            {t("seeWorkflows")}
          </a>
        </div>
      </section>

      <Suspense fallback={<div className="h-72" />}>
        <Showcase label={t("showcase")} />
      </Suspense>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pt-16">
        <div className="flex flex-col gap-2">
          <h2 className="font-title text-title-sm">{t("howTitle")}</h2>
          <p className="max-w-2xl text-text-2">{t("howLede")}</p>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ key, icon: Icon, tone }, i) => (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-card bg-card p-5 text-card-foreground shadow-paper"
            >
              <span className="flex items-center gap-3">
                <span
                  className={cn("grid size-10 place-items-center rounded-tile text-black", tone)}
                >
                  <Icon className="size-5" />
                </span>
                <span className="text-xs font-semibold tracking-wide text-paper-muted uppercase">
                  {i + 1}
                </span>
              </span>
              <h3 className="font-title text-xl">{t(`steps.${key}.title`)}</h3>
              <p className="text-[15px] text-paper-muted">{t(`steps.${key}.body`)}</p>
            </li>
          ))}
        </ol>
        <p className="max-w-3xl text-sm text-text-3">{t("proof")}</p>
      </section>

      <section id="workflows" className="flex scroll-mt-8 flex-col gap-5 pt-16">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6">
          <h2 className="font-title text-title-sm">{tw("title")}</h2>
          <p className="max-w-2xl text-text-2">{tw("hint")}</p>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto px-6 pb-4 [scrollbar-width:thin] lg:mx-auto lg:w-full lg:max-w-6xl">
          {BUILT_IN_WORKFLOWS.map((w) => {
            const look = WORKFLOW_LOOK[w.slug]
            const Icon = look?.icon
            return (
              <Link
                key={w.slug}
                href={`/w/${w.slug}`}
                className="group flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-card bg-card text-card-foreground shadow-paper transition-transform hover:-translate-y-1"
              >
                <span className={cn("grid h-24 place-items-center text-black", look?.tone)}>
                  {Icon ? (
                    <Icon className="size-9 transition-transform group-hover:scale-110" />
                  ) : null}
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-4">
                  <span className="font-title text-lg leading-tight">
                    {tw(`items.${w.slug}.name` as "items.night-in.name")}
                  </span>
                  <span className="text-sm text-paper-muted">
                    {tw(`items.${w.slug}.desc` as "items.night-in.desc")}
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <footer className="mx-auto mt-16 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-text-3">
        <span>{t("footer")}</span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-lime" /> {t("builtOn")}
        </span>
      </footer>
    </main>
  )
}
