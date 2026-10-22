import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { BookmarkPlus, Camera, Shapes, User } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { CopyLinkButton } from "@/components/workflows/copy-link-button"
import { MyWorkflows } from "@/components/workflows/my-workflows"
import { WORKFLOW_ICON } from "@/components/workflows/workflow-meta"
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
      <p className="flex items-start gap-3 rounded-card bg-card px-4 py-3.5 text-sm text-text-2 shadow-paper">
        <BookmarkPlus className="mt-0.5 size-4 shrink-0 text-text-3" strokeWidth={1.5} />{" "}
        {t("yoursEmpty")}
      </p>
    )
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-title text-[1.75rem]">{t("yours")}</h2>
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
      <section className="flex flex-col gap-3">
        <h2 className="font-title text-[1.75rem]">{t("readyMade")}</h2>
        <ul className="overflow-hidden rounded-card bg-card shadow-paper">
          {BUILT_IN_WORKFLOWS.map((w) => {
            const Icon = WORKFLOW_ICON[w.slug] ?? Shapes
            return (
              <li
                key={w.slug}
                className="flex items-center gap-1 border-b border-border pe-3 last:border-b-0"
              >
                <Link
                  href={`/c?workflow=${w.slug}`}
                  className="group flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-raised shadow-sticker">
                    <Icon className="size-[18px] text-text-2" strokeWidth={1.5} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-heading text-[15px]">
                      {t(`items.${w.slug}.name` as "items.night-in.name")}
                    </span>
                    <span className="line-clamp-2 text-[13px] text-text-3">
                      {t(`items.${w.slug}.desc` as "items.night-in.desc")}
                    </span>
                    {w.needs.photo || w.needs.person ? (
                      <span className="mt-1 flex items-center gap-3 font-mono text-[11px] text-text-3">
                        {w.needs.photo ? (
                          <span className="inline-flex items-center gap-1">
                            <Camera className="size-3" strokeWidth={1.5} /> {t("needsPhoto")}
                          </span>
                        ) : null}
                        {w.needs.person ? (
                          <span className="inline-flex items-center gap-1">
                            <User className="size-3" strokeWidth={1.5} /> {t("needsPerson")}
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                  <span className="ms-auto mt-1 shrink-0 rounded-pill bg-ink px-3 py-1 text-xs font-semibold text-on-ink">
                    {t("run")}
                  </span>
                </Link>
                <CopyLinkButton slug={w.slug} />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
