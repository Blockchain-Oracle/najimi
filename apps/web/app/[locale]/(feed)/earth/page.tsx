import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { EarthView } from "@/components/earth/earth-view"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Earth")
  return { title: t("title") }
}

async function Earth() {
  const session = await getSession()
  const self = session ? await selfOf(session.user.id) : null
  if (!self) redirect(`/start?next=${encodeURIComponent("/earth")}`)
  return <EarthView me={{ name: self.name, look: self.look }} />
}

/** The Earth: where your taste lives, city by city, and your people on the globe. */
export default function EarthPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-[#07060c] md:start-[5.5rem]" />}>
      <Earth />
    </Suspense>
  )
}
