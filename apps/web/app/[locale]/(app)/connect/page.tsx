import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { Feeds } from "@/components/connect/feeds"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Connect")
  return { title: t("title") }
}

async function Connect() {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (!self) redirect(`/start?next=${encodeURIComponent("/connect")}`)
  const t = await getTranslations("Connect")
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-5 pb-12 md:px-0">
      <h1 className="font-title text-[2rem] leading-none">{t("title")}</h1>
      <Feeds personId={self.id} />
    </div>
  )
}

/** Your feeds (W14, W15): your taste in from where it already lives, and out to your feeds. */
export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="mx-5 h-96 animate-pulse rounded-card bg-card md:mx-0" />}>
      <Connect />
    </Suspense>
  )
}
