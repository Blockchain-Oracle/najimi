import { calendarLinks } from "@najimi/booking"
import { db, schema } from "@najimi/db"
import { Orb } from "@najimi/ui/components/orb"
import { and, eq, gte, inArray, lte } from "drizzle-orm"
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
  // One-tap calendar links (Google, Outlook) for the night or the trip.
  const start = plan.startsAt
  const end = start
    ? new Date(start.getTime() + (plan.kind === "trip" ? plan.days * 24 * 3600_000 : 5 * 3600_000))
    : null
  const calendar =
    start && end
      ? calendarLinks({
          uid: plan.id,
          title: plan.title,
          start,
          end,
          where: plan.city,
          notes: plan.stops.map((s) => `${s.at ? `${s.at} ` : ""}${s.name}`).join("\n"),
        })
      : null
  // A stay booked in the same chat around those dates shows on the plan.
  const stays =
    plan.chatId && start && end
      ? await db
          .select({
            title: schema.bookings.title,
            venue: schema.bookings.venue,
            image: schema.bookings.image,
            status: schema.bookings.status,
            startsAt: schema.bookings.startsAt,
          })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.chatId, plan.chatId),
              eq(schema.bookings.kind, "hotel"),
              inArray(schema.bookings.status, ["confirmed", "paid", "completed"]),
              gte(schema.bookings.startsAt, new Date(start.getTime() - 24 * 3600_000)),
              lte(schema.bookings.startsAt, new Date(end.getTime() + 24 * 3600_000)),
            ),
          )
          .limit(2)
      : []
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
        shows: plan.shows,
      }}
      calendar={calendar}
      stays={stays.map((s) => ({
        name: s.venue ?? s.title,
        image: s.image,
        status: s.status,
        startsAt: s.startsAt?.toISOString() ?? null,
      }))}
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
