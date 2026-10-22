import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { BusinessPage } from "@/components/business/business-page"
import { businessOf, viewOfBusiness } from "@/lib/business"
import { getSession } from "@/lib/session"

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const session = await getSession()
  const b = session ? await businessOf((await params).id, session.user.id) : null
  return { title: b?.name ?? "Business", robots: { index: false } }
}

async function One({ params }: Pick<Props, "params">) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent(`/business/${id}`)}`)
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const b = await businessOf(id, session.user.id)
  if (!b) notFound()
  return <BusinessPage initial={viewOfBusiness(b)} />
}

/** One business's plan, building live or ready. */
export default function OneBusinessPage({ params }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-5 pb-16 md:px-0">
      <Suspense fallback={<div className="h-[52svh] animate-pulse rounded-sheet bg-card" />}>
        <One params={params} />
      </Suspense>
    </div>
  )
}
