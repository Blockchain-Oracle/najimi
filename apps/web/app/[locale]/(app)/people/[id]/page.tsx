import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { PersonView } from "@/components/people/person-view"
import { identityOf, personPage } from "@/lib/people"
import { getSession } from "@/lib/session"

async function Person({ params }: { params: PageProps<"/[locale]/people/[id]">["params"] }) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/start")
  const page = await personPage(session.user.id, id).catch(() => null)
  if (!page) notFound()
  return (
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

export default function PersonPage({ params }: PageProps<"/[locale]/people/[id]">) {
  return (
    <Suspense fallback={<PersonSkeleton />}>
      <Person params={params} />
    </Suspense>
  )
}
