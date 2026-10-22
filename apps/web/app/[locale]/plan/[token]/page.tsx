import { Orb } from "@najimi/ui/components/orb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { PlanView } from "@/components/plans/plan-view"
import { planByToken } from "@/lib/plans"
import { getSession } from "@/lib/session"

type Props = PageProps<"/[locale]/plan/[token]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const plan = await planByToken((await params).token)
  if (!plan) return { robots: { index: false } }
  const description = plan.stops
    .slice(0, 4)
    .map((s) => s.name)
    .join(" → ")
  const images = [{ url: `/api/plans/${plan.token}/map`, width: 1280, height: 720 }]
  return {
    title: plan.title,
    description,
    robots: { index: false },
    openGraph: { title: plan.title, description, images },
  }
}

async function Plan({ params }: Pick<Props, "params">) {
  const plan = await planByToken((await params).token)
  if (!plan) notFound()
  const session = await getSession()
  return (
    <PlanView
      plan={{
        token: plan.token,
        kind: plan.kind,
        title: plan.title,
        city: plan.city,
        startsAt: plan.startsAt?.toISOString() ?? null,
        party: plan.party,
        stops: plan.stops,
        route: plan.route,
        lat: plan.lat,
        lon: plan.lon,
      }}
      signedIn={Boolean(session)}
    />
  )
}

/** A plan anyone with the link can open: the route, the stops, the calendar. */
export default function PlanPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="dark grid min-h-dvh place-items-center bg-background">
          <Orb size={88} working />
        </main>
      }
    >
      <Plan params={params} />
    </Suspense>
  )
}
