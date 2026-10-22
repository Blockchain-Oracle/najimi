import { ArrowRight, Camera, ListChecks, User } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { WORKFLOW_ICON } from "@/components/workflows/workflow-meta"
import { getSession } from "@/lib/session"
import { isBuiltIn, runnableWorkflow, type WorkflowRow } from "@/lib/workflows"

type Props = PageProps<"/[locale]/w/[slug]">

/** A workflow's words: built-ins speak the page's language, saved ones their maker's. */
async function wordsOf(w: WorkflowRow) {
  const t = await getTranslations("Workflows")
  return isBuiltIn(w)
    ? {
        name: t(`items.${w.slug}.name` as "items.night-in.name"),
        description: t(`items.${w.slug}.desc` as "items.night-in.desc"),
        category: t(`categories.${w.category}` as "categories.home"),
      }
    : { name: w.name, description: w.description, category: t("categories.mine") }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params
  const w = await runnableWorkflow(null, slug)
  if (!w) return {}
  const { name, description } = await wordsOf(w)
  const images = [{ url: `/api/og/w/${w.slug}?l=${locale}`, width: 1200, height: 630 }]
  return {
    title: name,
    description,
    openGraph: { title: name, description, images },
    twitter: { card: "summary_large_image", title: name, description, images },
  }
}

/**
 * A workflow anyone can open from a link (T15): what it does, and Run. Someone new meets Najimi
 * first (three things they love) and lands back in the run.
 */
async function Workflow({ params }: { params: Props["params"] }) {
  const { slug } = await params
  const session = await getSession()
  const w = await runnableWorkflow(session?.user.id ?? null, slug)
  if (!w) notFound()
  const t = await getTranslations("Workflows")
  const { name, description, category } = await wordsOf(w)
  const Icon = WORKFLOW_ICON[w.slug] ?? ListChecks
  const steps = isBuiltIn(w) ? [] : w.instructions.split("\n").filter((s) => s.trim())
  return (
    <article className="overflow-hidden rounded-card bg-card text-card-foreground shadow-paper">
      <div className="flex flex-col gap-4 p-6">
        <span className="grid size-11 place-items-center rounded-tile bg-raised shadow-sticker">
          <Icon className="size-5 text-text-2" strokeWidth={1.5} />
        </span>
        <p className="font-mono text-xs text-text-3">
          {category}
          {w.runsCount > 0 ? ` · ${t("runs", { count: w.runsCount })}` : ""}
        </p>
        <h1 className="font-title text-title-sm leading-tight">{name}</h1>
        {description ? <p className="text-paper-muted">{description}</p> : null}
        {steps.length ? (
          <ol className="flex flex-col gap-2 border-t border-border pt-4">
            {steps.map((s) => (
              <li key={s} className="text-[15px] leading-relaxed">
                {s}
              </li>
            ))}
          </ol>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-sm text-paper-muted">
          {w.needs.photo ? (
            <span className="inline-flex items-center gap-1.5">
              <Camera className="size-4" /> {t("needsPhoto")}
            </span>
          ) : null}
          {w.needs.person ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-4" /> {t("needsPerson")}
            </span>
          ) : null}
        </div>
        <Link
          href={`/c?workflow=${w.slug}`}
          className="mt-2 inline-flex items-center justify-center gap-2 self-start rounded-pill bg-ink px-6 py-3 font-semibold text-on-ink transition-opacity hover:opacity-90"
        >
          {t("runThis")} <ArrowRight className="size-4 rtl:rotate-180" />
        </Link>
        {session ? null : <p className="text-sm text-paper-muted">{t("newHere")}</p>}
      </div>
    </article>
  )
}

export default async function WorkflowLinkPage(props: Props) {
  const t = await getTranslations("Share")
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-title text-[22px]">
          najimi
        </Link>
        <Link href="/workflows" className="text-sm font-semibold text-text-2 hover:text-foreground">
          {t("moreWorkflows")}
        </Link>
      </header>
      <Suspense fallback={<div className="h-[28rem] animate-pulse rounded-card bg-card" />}>
        <Workflow params={props.params} />
      </Suspense>
      <p className="text-text-2">{t("pitch")}</p>
    </main>
  )
}
