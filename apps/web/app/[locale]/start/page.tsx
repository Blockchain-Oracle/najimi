import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Onboarding } from "@/components/start/onboarding"
import { safeNext } from "@/lib/next-path"
import { pageLocale } from "@/lib/page-locale"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

type Search = PageProps<"/[locale]/start">["searchParams"]

/** Someone who already told us who they are goes straight on: where they were headed, or their taste. */
async function AlreadyOnboarded({ searchParams }: { searchParams: Search }) {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (self) redirect(safeNext((await searchParams).next) ?? `/people/${self.id}`)
  return null
}

async function Flow({ searchParams }: { searchParams: Search }) {
  return <Onboarding next={safeNext((await searchParams).next)} />
}

export default async function StartPage({ params, searchParams }: PageProps<"/[locale]/start">) {
  await pageLocale(params)
  return (
    <>
      <Suspense fallback={null}>
        <AlreadyOnboarded searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<Onboarding next={null} />}>
        <Flow searchParams={searchParams} />
      </Suspense>
    </>
  )
}
