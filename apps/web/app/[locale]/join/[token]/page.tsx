import { Orb } from "@najimi/ui/components/orb"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { joinCircle } from "@/lib/chat/join"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

type Props = PageProps<"/[locale]/join/[token]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const images = [{ url: `/api/og/join/${token}`, width: 1200, height: 630 }]
  return {
    title: "Join the circle",
    description: "The group-chat agent that plans for everyone's taste.",
    robots: { index: false },
    openGraph: { title: "Join the circle on Najimi", images },
    twitter: { card: "summary_large_image", images },
  }
}

async function Join({ params }: Pick<Props, "params">) {
  const { token } = await params
  if (!/^[a-z0-9]{8,32}$/.test(token)) notFound()
  // Someone new picks a few loves first (a guest is fine), then lands back here and joins.
  const back = `/start?next=${encodeURIComponent(`/join/${token}`)}`
  const session = await getSession()
  if (!session) redirect(back)
  const self = await selfOf(session.user.id)
  if (!self) redirect(back)
  const chatId = await joinCircle(token, session.user.id, self.name)
  if (chatId) redirect(`/c/${chatId}`)
  const t = await getTranslations("Social")
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Orb size={96} />
        <h1 className="font-title text-[2rem]">{t("inviteGone")}</h1>
      </div>
    </main>
  )
}

/** A circle's invite link: sign up if needed, then straight into the circle. */
export default function JoinPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center">
          <Orb size={96} working />
        </main>
      }
    >
      <Join params={params} />
    </Suspense>
  )
}
