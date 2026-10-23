import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { PeopleView } from "@/components/people/people-view"
import { getSession } from "@/lib/session"
import { peopleHome } from "@/lib/social"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Social")
  return { title: t("title") }
}

async function People() {
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent("/people")}`)
  const home = await peopleHome(session.user.id)
  if (!home.self) redirect(`/start?next=${encodeURIComponent("/people")}`)
  return (
    <PeopleView
      home={{
        art: home.art,
        self: { name: home.self.name, look: home.self.look },
        lounge: home.lounge,
        friends: home.friends,
        twins: home.twins,
        circles: home.circles,
        unread: home.unread,
        after: home.after,
        figures: home.figures,
      }}
    />
  )
}

/** People: search, circles, friends, taste twins, people in culture who share your taste. */
export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="mx-5 h-96 animate-pulse rounded-card bg-card md:mx-0" />}>
      <People />
    </Suspense>
  )
}
