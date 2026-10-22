import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { FeedView } from "@/components/feed/feed-view"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Feed")
  return { title: t("title") }
}

async function Feed() {
  // Someone new picks a few loves first, then lands back here.
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (!self) redirect(`/start?next=${encodeURIComponent("/feed")}`)
  return <FeedView />
}

/** The feed: your taste as music, episodes, films and places, a card at a time. */
export default function FeedPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black md:start-[5.5rem]" />}>
      <Feed />
    </Suspense>
  )
}
