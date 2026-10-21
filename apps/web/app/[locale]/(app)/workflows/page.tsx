import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { cn } from "@najimi/ui/lib/utils"
import { BookmarkPlus, Camera, User } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { CopyLinkButton } from "@/components/workflows/copy-link-button"
import { MyWorkflows } from "@/components/workflows/my-workflows"
import { WORKFLOW_LOOK } from "@/components/workflows/workflow-meta"
import { getSession } from "@/lib/session"
import { ownWorkflows } from "@/lib/workflows"

/** The person's own workflows, saved from chats (nothing shows until there's one). */
async function Yours() {
  const session = await getSession()
  if (!session) return null
  const rows = await ownWorkflows(session.user.id)
  const t = await getTranslations("Workflows")
  // Nobody finds "save a chat as a workflow" by accident: say where it lives until they have one.
  if (!rows.length)
    return (
      <p className="flex items-start gap-2 rounded-tile border border-foreground/12 px-4 py-3 text-sm text-text-2">
        <BookmarkPlus className="mt-0.5 size-4 shrink-0 text-lime" /> {t("yoursEmpty")}
      </p>
    )
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-title text-2xl">{t("yours")}</h2>
      <MyWorkflows
        items={rows.map((w) => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
          description: w.description,
          steps: w.instructions.split("\n").filter((s) => s.trim()).length,
          public: w.public,
          runsCount: w.runsCount,
        }))}
      />
    </section>
  )
}

/** The workflow library (T15): recipes for bigger jobs, each run in a chat over the same tools. */
export default async function WorkflowsPage() {
  const t = await getTranslations("Workflows")
  return (
    <div className="flex flex-col gap-6 px-5 pb-16 md:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="font-title text-title-sm">{t("title")}</h1>
        <p className="text-text-2">{t("hint")}</p>
      </div>
      <Suspense fallback={null}>
        <Yours />
      </Suspense>
      <h2 className="-mb-3 font-title text-2xl">{t("readyMade")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUILT_IN_WORKFLOWS.map((w) => {
          const look = WORKFLOW_LOOK[w.slug]
          const Icon = look?.icon
          return (
            <div key={w.slug} className="relative">
              <Link
                href={`/c?workflow=${w.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-card bg-card text-card-foreground shadow-paper transition-transform hover:-translate-y-1"
              >
                <div className={cn("grid h-28 place-items-center text-black", look?.tone)}>
                  {Icon ? (
                    <Icon className="size-10 transition-transform group-hover:scale-110" />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                    {t(`categories.${w.category}`)}
                  </p>
                  <h2 className="font-title text-xl leading-tight">
                    {t(`items.${w.slug}.name` as "items.night-in.name")}
                  </h2>
                  <p className="text-sm text-paper-muted">
                    {t(`items.${w.slug}.desc` as "items.night-in.desc")}
                  </p>
                  <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-paper-muted">
                    {w.needs.photo ? (
                      <span className="inline-flex items-center gap-1">
                        <Camera className="size-3.5" /> {t("needsPhoto")}
                      </span>
                    ) : null}
                    {w.needs.person ? (
                      <span className="inline-flex items-center gap-1">
                        <User className="size-3.5" /> {t("needsPerson")}
                      </span>
                    ) : null}
                    <span className="ms-auto rounded-pill bg-lime px-3 py-1 text-xs font-semibold text-lime-foreground">
                      {t("run")}
                    </span>
                  </div>
                </div>
              </Link>
              <CopyLinkButton slug={w.slug} className="absolute end-3 top-3" />
            </div>
          )
        })}
      </div>
    </div>
  )
}
