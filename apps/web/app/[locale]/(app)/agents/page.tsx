import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { AgentsView } from "@/components/agents/agents-view"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Agents")
  return { title: t("title") }
}

async function Agents() {
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent("/agents")}`)
  return <AgentsView />
}

/** Your agents (W15): what acts for you on your own accounts, and the routines Najimi runs for you. */
export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="mx-5 h-96 animate-pulse rounded-card bg-card md:mx-0" />}>
      <Agents />
    </Suspense>
  )
}
