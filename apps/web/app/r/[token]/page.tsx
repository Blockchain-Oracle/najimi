import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ReportView } from "@/components/report/report-view"
import type { Report } from "@/components/report/types"
import { TopBar } from "@/components/shell/top-bar"

async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound()
  const [report] = await db
    .select()
    .from(schema.peopleReports)
    .where(eq(schema.peopleReports.shareToken, token))
  if (!report) notFound()
  const [business] = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, report.businessId))
  if (!business) notFound()
  return (
    <ReportView
      businessId={business.id}
      businessName={business.name ?? business.host ?? "This business"}
      initial={JSON.parse(JSON.stringify(report)) as Report}
      publicView
    />
  )
}

/** A shared Your People report: read-only, signed-out, evidence shown as purpose only. */
export default function SharedReport({ params }: PageProps<"/r/[token]">) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-10 px-6 pb-20">
      <TopBar />
      <Suspense fallback={<div className="mt-24 h-40 w-2/3 animate-pulse rounded-card bg-ash" />}>
        <Shared params={params} />
      </Suspense>
    </main>
  )
}
