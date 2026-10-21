import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { cn } from "@najimi/ui/lib/utils"
import { Camera, User } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { WORKFLOW_LOOK } from "@/components/workflows/workflow-meta"

/** The workflow library (T15): recipes for bigger jobs, each run in a chat over the same tools. */
export default async function WorkflowsPage() {
  const t = await getTranslations("Workflows")
  return (
    <div className="flex flex-col gap-6 px-5 pb-16 md:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="font-title text-title-sm">{t("title")}</h1>
        <p className="text-text-2">{t("hint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BUILT_IN_WORKFLOWS.map((w) => {
          const look = WORKFLOW_LOOK[w.slug]
          const Icon = look?.icon
          return (
            <Link
              key={w.slug}
              href={`/c?workflow=${w.slug}`}
              className="group flex flex-col overflow-hidden rounded-card bg-card text-card-foreground shadow-paper transition-transform hover:-translate-y-1"
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
          )
        })}
      </div>
    </div>
  )
}
