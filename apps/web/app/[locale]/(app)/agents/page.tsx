import { SOCIAL } from "@najimi/config"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { AgentsView } from "@/components/agents/agents-view"
import { ComingSoon } from "@/components/connect/coming-soon"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Agents")
  return { title: t("title") }
}

async function Agents() {
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent("/agents")}`)
  if (SOCIAL.connectSoon) {
    const [self, t] = await Promise.all([selfOf(session.user.id), getTranslations("Agents")])
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 pb-12 md:px-0">
        <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
        <ComingSoon kind="agents" personId={self?.id ?? null} />
      </div>
    )
  }
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
