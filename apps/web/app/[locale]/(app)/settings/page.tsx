import { ALLOWANCE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { DeleteData } from "@/components/settings/delete-data"
import { ModePicker } from "@/components/settings/mode-picker"
import { usageToday } from "@/lib/chat/usage"
import { getSession } from "@/lib/session"

const card = "flex flex-col gap-4 rounded-card bg-card p-5 text-card-foreground shadow-paper"
const COUNTERS = ["turns", "images", "videos"] as const

/** One day's allowance, used against the limit (rule 6). */
function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = Math.min(1, used / limit)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tnum text-paper-muted">
          {used} / {limit}
        </span>
      </div>
      {/* The numbers above say it; the bar is for the eye. */}
      <div aria-hidden className="h-2 overflow-hidden rounded-pill bg-paper-foreground/8">
        <div
          className={share >= 1 ? "h-full bg-destructive" : "h-full bg-lime-ink"}
          style={{ width: `${share * 100}%` }}
        />
      </div>
    </div>
  )
}

/** The parts that depend on who's signed in: how chats make things, today's allowance, account. */
async function Mine() {
  const session = await getSession()
  if (!session) redirect("/start?next=%2Fsettings")
  const t = await getTranslations("Settings")
  const ta = await getTranslations("Auth")
  const user = session.user as typeof session.user & { isAnonymous?: boolean | null }
  const guest = Boolean(user.isAnonymous)
  const [[prefs], used] = await Promise.all([
    db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, user.id)),
    usageToday(user.id),
  ])
  const limits = guest ? ALLOWANCE.guest : ALLOWANCE.member
  return (
    <>
      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-title text-xl">{t("mode")}</h2>
          <p className="text-sm text-paper-muted">{t("modeHint")}</p>
        </div>
        <ModePicker initial={prefs?.mode ?? "ask"} />
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-title text-xl">{t("today")}</h2>
          <p className="text-sm text-paper-muted">{guest ? t("todayGuest") : t("todayMember")}</p>
        </div>
        {COUNTERS.map((c) => (
          <Meter key={c} label={t(`counters.${c}`)} used={used[c]} limit={limits[c]} />
        ))}
      </section>

      <section className={card}>
        <h2 className="font-title text-xl">{t("account")}</h2>
        <p className="text-[15px]">
          {guest ? ta("guest") : ta("signedInAs", { email: user.email })}
        </p>
        {guest ? <p className="text-sm text-paper-muted">{ta("hint")}</p> : null}
      </section>

      <section className={`${card} ring-1 ring-destructive/30`}>
        <div className="flex flex-col gap-1">
          <h2 className="font-title text-xl">{t("deleteHeading")}</h2>
          <p className="text-sm text-paper-muted">{t("deleteHint")}</p>
        </div>
        <DeleteData />
      </section>
    </>
  )
}

/** Settings (T21): language, how chats make things, today's allowance, and delete all my data. */
export default async function SettingsPage() {
  const t = await getTranslations("Settings")
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <h1 className="font-title text-title-sm">{t("title")}</h1>
      <section className="flex items-center justify-between rounded-card bg-card p-5 text-card-foreground shadow-paper">
        <span className="font-title text-xl">{t("language")}</span>
        <LanguageMenu />
      </section>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card/10" aria-busy />}>
        <Mine />
      </Suspense>
    </div>
  )
}
