import { ArrowRight } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { PersonView } from "@/components/people/person-view"
import { safeNext } from "@/lib/next-path"
import { identityOf, personPage } from "@/lib/people"
import { getSession } from "@/lib/session"
import { isBuiltIn, runnableWorkflow } from "@/lib/workflows"

type Props = PageProps<"/[locale]/people/[id]">

/** After the reveal, someone who came from a shared workflow link carries on to it. */
async function CarryOn({ next, userId }: { next: string; userId: string }) {
  const t = await getTranslations("Start")
  const slug = /^\/c\?workflow=([a-z0-9-]+)$/.exec(next)?.[1]
  const workflow = slug ? await runnableWorkflow(userId, slug) : null
  const tw = await getTranslations("Workflows")
  const name = workflow
    ? isBuiltIn(workflow)
      ? tw(`items.${workflow.slug}.name` as "items.night-in.name")
      : workflow.name
    : null
  return (
    <Link
      href={next}
      className="mx-5 flex items-center justify-between gap-3 rounded-card bg-lime px-5 py-4 text-lime-foreground shadow-sticker transition-transform hover:-translate-y-0.5 md:mx-0"
    >
      <span className="flex flex-col">
        <span className="text-xs font-semibold tracking-wide uppercase opacity-70">
          {t("carryOnHint")}
        </span>
        <span className="font-title text-xl">{name ?? t("carryOn")}</span>
      </span>
      <ArrowRight className="size-6 shrink-0 rtl:rotate-180" />
    </Link>
  )
}

async function Person({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/start")
  const page = await personPage(session.user.id, id).catch(() => null)
  if (!page) notFound()
  const next = page.person.isSelf ? safeNext((await searchParams).next) : null
  return (
    <div className="flex flex-col gap-6">
      {next ? <CarryOn next={next} userId={session.user.id} /> : null}
      <PersonView
        data={{
          person: {
            id: page.person.id,
            name: page.person.name,
            isSelf: page.person.isSelf,
            city: page.person.city,
            ageBand: page.person.ageBand,
            constraints: page.person.constraints,
          },
          identity: identityOf(page.person.id),
          loves: page.loves.map((l) => ({
            id: l.id,
            qlooId: l.qlooId,
            type: l.type,
            name: l.name,
            imageUrl: l.imageUrl,
            weight: l.weight,
          })),
          taste: page.taste
            ? {
                words: page.taste.words,
                picks: page.taste.picks,
                bridges: page.taste.bridges,
                runId: page.taste.runId,
                computedAt: page.taste.computedAt?.toISOString() ?? null,
              }
            : null,
          runStatus: page.runStatus,
          saved: page.saved.map((s) => ({
            qlooId: s.qlooId,
            type: s.type,
            name: s.name,
            imageUrl: s.imageUrl,
          })),
        }}
      />
    </div>
  )
}

function PersonSkeleton() {
  return (
    <div className="mx-5 flex flex-col gap-6 md:mx-0">
      <div className="h-80 animate-pulse rounded-card bg-card/10" />
      <div className="h-56 animate-pulse rounded-card bg-card/5" />
    </div>
  )
}

export default function PersonPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <Person params={params} searchParams={searchParams} />
    </Suspense>
  )
}
