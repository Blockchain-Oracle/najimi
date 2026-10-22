import { usageToday } from "@najimi/agent/server"
import { ALLOWANCE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { and, eq, gte, sql } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { AuraFace } from "@/components/people/person-row"
import { ProfileForm } from "@/components/people/profile-form"
import { BlockedPeople } from "@/components/settings/blocked-people"
import { DeleteData } from "@/components/settings/delete-data"
import { ModePicker } from "@/components/settings/mode-picker"
import { PushSettings } from "@/components/settings/push-settings"
import { ShareLinks } from "@/components/settings/share-links"
import { linksOf } from "@/lib/links"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

const card = "flex flex-col gap-4 rounded-card bg-card p-5 text-card-foreground"
/** Videos are switched off (MEDIA.video.enabled), so their counter isn't shown. */
const COUNTERS = ["turns", "images", "calls", "holds"] as const

/** What the models cost while working for them this month (W26), from every logged call. */
async function spentThisMonth(userId: string): Promise<number> {
  const start = new Date()
  start.setUTCDate(1)
  start.setUTCHours(0, 0, 0, 0)
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.llmCalls.costUsd}), 0)::float` })
    .from(schema.llmCalls)
    .where(and(eq(schema.llmCalls.userId, userId), gte(schema.llmCalls.createdAt, start)))
  return Number(row?.total ?? 0)
}

/** One day's allowance, used against the limit (rule 6). */
function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const share = Math.min(1, used / limit)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tnum text-text-3">
          {used} / {limit}
        </span>
      </div>
      {/* The numbers above say it; the bar is for the eye. */}
      <div aria-hidden className="h-2 overflow-hidden rounded-pill bg-secondary">
        <div
          className={
            share >= 1
              ? "h-full bg-destructive"
              : "h-full bg-[linear-gradient(90deg,var(--color-aura-1),var(--color-aura-2))]"
          }
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
  const [[prefs], used, spent, links, self, [account]] = await Promise.all([
    db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, user.id)),
    usageToday(user.id),
    spentThisMonth(user.id),
    linksOf(user.id),
    selfOf(user.id),
    db
      .select({ username: schema.user.displayUsername })
      .from(schema.user)
      .where(eq(schema.user.id, user.id)),
  ])
  const limits = guest ? ALLOWANCE.guest : ALLOWANCE.member
  return (
    <>
      {self ? (
        <section className={card}>
          <div className="flex items-center gap-3">
            <AuraFace person={self} size="md" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-heading text-[17px]">{self.name}</span>
              {account?.username ? (
                <span className="text-[13px] text-text-3">@{account.username}</span>
              ) : null}
            </span>
          </div>
          <ProfileForm
            person={{
              id: self.id,
              name: self.name,
              city: self.city,
              bio: self.bio,
              visibility: self.visibility,
              radar: self.radar,
            }}
          />
        </section>
      ) : null}

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("notifications")}</h2>
          <p className="text-sm text-text-3">{t("notificationsHint")}</p>
        </div>
        <PushSettings />
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("mode")}</h2>
          <p className="text-sm text-text-3">{t("modeHint")}</p>
        </div>
        <ModePicker initial={prefs?.mode ?? "ask"} />
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("today")}</h2>
          <p className="text-sm text-text-3">{guest ? t("todayGuest") : t("todayMember")}</p>
        </div>
        {COUNTERS.map((c) => (
          <Meter key={c} label={t(`counters.${c}`)} used={used[c]} limit={limits[c]} />
        ))}
        <p className="text-sm text-text-3">
          {t("spent", { amount: spent < 0.01 ? "<$0.01" : `$${spent.toFixed(2)}` })}
        </p>
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("links")}</h2>
          <p className="text-sm text-text-3">{t("linksHint")}</p>
        </div>
        <ShareLinks items={links.map(({ kind, id, title, path }) => ({ kind, id, title, path }))} />
      </section>

      <section className={card}>
        <h2 className="font-heading text-[17px]">{t("blocked")}</h2>
        <BlockedPeople />
      </section>

      <section className={card}>
        <h2 className="font-heading text-[17px]">{t("account")}</h2>
        <p className="text-[15px]">
          {guest ? ta("guest") : ta("signedInAs", { email: user.email })}
        </p>
        {guest ? <p className="text-sm text-text-3">{ta("hint")}</p> : null}
      </section>

      <section className={`${card} ring-1 ring-destructive/30`}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("deleteHeading")}</h2>
          <p className="text-sm text-text-3">{t("deleteHint")}</p>
        </div>
        <DeleteData />
      </section>
    </>
  )
}

/** Settings: you (profile and who sees it), how Najimi acts, language, today, links, your data. */
export default async function SettingsPage() {
  const t = await getTranslations("Settings")
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <h1 className="font-title text-title-sm">{t("title")}</h1>
      <section className="flex items-center justify-between rounded-card bg-card p-5 text-card-foreground">
        <span className="font-heading text-[17px]">{t("language")}</span>
        <LanguageMenu />
      </section>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card/10" aria-busy />}>
        <Mine />
      </Suspense>
    </div>
  )
}
