import { redirect } from "next/navigation"
import { Suspense } from "react"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

async function GoToMe(): Promise<null> {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  redirect(self ? `/people/${self.id}` : "/start")
}

/** "Me": my own taste page, or the sign-up when I haven't told Najimi who I am yet. */
export default function MePage() {
  return (
    <Suspense fallback={null}>
      <GoToMe />
    </Suspense>
  )
}
