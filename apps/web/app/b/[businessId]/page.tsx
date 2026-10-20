import { claudeConfigured } from "@najimi/claude"
import { db, schema } from "@najimi/db"
import { qlooConfigured } from "@najimi/qloo"
import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { type BusinessData, SetupView } from "@/components/setup/setup-view"
import { TopBar } from "@/components/shell/top-bar"
import { ownedBusiness } from "@/lib/access"
import { getSession } from "@/lib/session"

async function load(businessId: string): Promise<BusinessData | null> {
  const session = await getSession()
  const id = z.uuid().safeParse(businessId).data
  if (!session || !id) return null
  const business = await ownedBusiness(session.user.id, id)
  if (!business) return null
  const [facts, matches] = await Promise.all([
    db
      .select()
      .from(schema.businessFacts)
      .where(eq(schema.businessFacts.businessId, id))
      .orderBy(asc(schema.businessFacts.position), asc(schema.businessFacts.createdAt)),
    db.select().from(schema.qlooMatches).where(eq(schema.qlooMatches.businessId, id)),
  ])
  return JSON.parse(
    JSON.stringify({
      business,
      facts,
      matches,
      services: { qloo: qlooConfigured(), claude: claudeConfigured() },
    }),
  ) as BusinessData
}

async function Setup({ params }: { params: Promise<{ businessId: string }> }) {
  const data = await load((await params).businessId)
  if (!data) notFound()
  return <SetupView initial={data} />
}

export default function BusinessPage({ params }: PageProps<"/b/[businessId]">) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-10 px-6 pb-16">
      <TopBar />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-ash" />}>
        <Setup params={params} />
      </Suspense>
    </main>
  )
}
