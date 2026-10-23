import { db, schema } from "@najimi/db"
import { and, eq, isNull } from "drizzle-orm"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { PassportView } from "@/components/passport/passport-view"
import { movement, selfIdOf, stampsOf, upcomingOf } from "@/lib/passport"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Passport")
  return { title: t("title") }
}

async function Passport() {
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent("/passport")}`)
  const personId = await selfIdOf(session.user.id)
  if (!personId) redirect(`/start?next=${encodeURIComponent("/passport")}`)
  const year = new Date().getUTCFullYear()
  const [stamps, upcoming, [share]] = await Promise.all([
    stampsOf(session.user.id, year),
    upcomingOf(session.user.id),
    db
      .select({ token: schema.shares.token })
      .from(schema.shares)
      .where(
        and(
          eq(schema.shares.ownerId, session.user.id),
          eq(schema.shares.kind, "wrapped"),
          eq(schema.shares.refId, personId),
          isNull(schema.shares.revokedAt),
        ),
      ),
  ])
  return (
    <PassportView
      year={year}
      stamps={stamps}
      upcoming={upcoming}
      movement={movement(stamps)}
      wrappedToken={share?.token ?? null}
      personId={personId}
    />
  )
}

/** Your Taste Passport (W21) and your Wrapped (W22). */
export default function PassportPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pb-16 md:px-0">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card" />}>
        <Passport />
      </Suspense>
    </div>
  )
}
