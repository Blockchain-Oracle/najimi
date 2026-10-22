import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { GraphView } from "@/components/graph/graph-view"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Graph")
  return { title: t("title") }
}

async function Graph() {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (!self) redirect(`/start?next=${encodeURIComponent("/graph")}`)
  return <GraphView />
}

/** Your taste as a graph you can pull apart, re-weigh and grow. */
export default function GraphPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#07060c] md:start-[5.5rem]" />}>
      <Graph />
    </Suspense>
  )
}
