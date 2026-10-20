import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { z } from "zod"
import { ReportView } from "@/components/report/report-view"
import type { Report } from "@/components/report/types"
import { TopBar } from "@/components/shell/top-bar"
import { ownedBusiness } from "@/lib/access"
import { latestReport } from "@/lib/reports"
import { getSession } from "@/lib/session"

async function Body({ params }: { params: Promise<{ businessId: string }> }) {
  const session = await getSession()
  const id = z.uuid().safeParse((await params).businessId).data
  if (!session || !id) notFound()
  const business = await ownedBusiness(session.user.id, id)
  if (!business) notFound()
  const report = await latestReport(id)
  return (
    <>
      <TopBar>
        <Link href={`/b/${id}`} className="text-text-2 hover:text-foreground">
          {business.name ?? business.host}
        </Link>
      </TopBar>
      <ReportView
        businessId={id}
        businessName={business.name ?? business.host ?? "This business"}
        initial={report ? (JSON.parse(JSON.stringify(report)) as Report) : null}
      />
    </>
  )
}

export default function PeoplePage({ params }: PageProps<"/b/[businessId]/people">) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-10 px-6 pb-20">
      <Suspense fallback={<div className="mt-24 h-40 w-2/3 animate-pulse rounded-card bg-ash" />}>
        <Body params={params} />
      </Suspense>
    </main>
  )
}
