import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Onboarding } from "@/components/start/onboarding"
import { pageLocale } from "@/lib/page-locale"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

/** Someone who already told us who they are goes straight to their taste. */
async function AlreadyOnboarded() {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (self) redirect(`/people/${self.id}`)
  return null
}

export default async function StartPage({ params }: PageProps<"/[locale]/start">) {
  await pageLocale(params)
  return (
    <>
      <Suspense fallback={null}>
        <AlreadyOnboarded />
      </Suspense>
      <Onboarding />
    </>
  )
}
