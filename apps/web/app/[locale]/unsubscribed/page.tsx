import { MailCheck } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { pageLocale } from "@/lib/page-locale"

export const metadata: Metadata = { title: "Unsubscribed", robots: { index: false } }

/** Which email was turned off (it comes from the link, so it's read inside the boundary). */
async function Done({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const t = await getTranslations("Email")
  const { k } = await searchParams
  return (
    <h1 className="font-title text-[1.7rem] leading-tight">
      {k === "weekly" ? t("offWeekly") : k === "news" ? t("offNews") : t("badLink")}
    </h1>
  )
}

/** Where an email's unsubscribe link lands: done, in a line, and the way to change it back. */
export default async function UnsubscribedPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ k?: string }>
}) {
  await pageLocale(params)
  const t = await getTranslations("Email")
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-card ring-1 ring-border">
        <MailCheck className="size-6" />
      </span>
      <Suspense fallback={<div className="h-9 w-56 animate-pulse rounded-pill bg-card" />}>
        <Done searchParams={searchParams} />
      </Suspense>
      <p className="text-[15px] text-text-2">{t("changeBack")}</p>
      <Link
        href="/settings"
        className="mt-2 inline-flex h-11 items-center rounded-pill bg-primary px-5 font-semibold text-primary-foreground"
      >
        {t("openSettings")}
      </Link>
    </main>
  )
}
