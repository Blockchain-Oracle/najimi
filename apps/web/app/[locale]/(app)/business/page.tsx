import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { Businesses } from "@/components/business/businesses"
import { businessesOf, viewOfBusiness } from "@/lib/business"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Business")
  return { title: t("title") }
}

async function List() {
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent("/business")}`)
  const [list, self] = await Promise.all([businessesOf(session.user.id), selfOf(session.user.id)])
  return <Businesses list={list.map(viewOfBusiness)} city={self?.city ?? null} />
}

/** Business mode (W19): your businesses and their plans. */
export default function BusinessesPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-5 pb-12 md:px-0">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-card" />}>
        <List />
      </Suspense>
    </div>
  )
}
