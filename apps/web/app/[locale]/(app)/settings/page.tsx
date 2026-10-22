import { usageToday } from "@najimi/agent/server"
import { ALLOWANCE } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { AuraFace } from "@/components/people/person-row"
import { ProfileForm } from "@/components/people/profile-form"
import { DeleteData } from "@/components/settings/delete-data"
import { ModePicker } from "@/components/settings/mode-picker"
import { type ShareItem, ShareLinks } from "@/components/settings/share-links"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

const card = "flex flex-col gap-4 rounded-card bg-card p-5 text-card-foreground"
/** Videos are switched off (MEDIA.video.enabled), so their counter isn't shown. */
const COUNTERS = ["turns", "images"] as const

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

/** The person's live share links, each named by what it shows. */
async function sharesOf(userId: string, untitled: string): Promise<ShareItem[]> {
  const rows = await db
    .select()
    .from(schema.shares)
    .where(and(eq(schema.shares.ownerId, userId), isNull(schema.shares.revokedAt)))
    .orderBy(desc(schema.shares.createdAt))
  const ids = (kind: string) => rows.filter((r) => r.kind === kind).map((r) => r.refId)
  const [creations, chats, people] = await Promise.all([
    ids("creation").length
      ? db
          .select({ id: schema.creations.id, label: schema.creations.title })
          .from(schema.creations)
          .where(inArray(schema.creations.id, ids("creation")))
      : [],
    ids("chat").length
      ? db
          .select({ id: schema.chats.id, label: schema.chats.title })
          .from(schema.chats)
          .where(inArray(schema.chats.id, ids("chat")))
      : [],
    ids("person").length
      ? db
          .select({ id: schema.people.id, label: schema.people.name })
          .from(schema.people)
          .where(inArray(schema.people.id, ids("person")))
      : [],
  ])
  const labels = new Map([...creations, ...chats, ...people].map((r) => [r.id, r.label]))
  return rows.map((r) => ({
    token: r.token,
    kind: r.kind,
    label: labels.get(r.refId) ?? untitled,
    createdAt: r.createdAt.toISOString(),
  }))
}

/** The parts that depend on who's signed in: how chats make things, today's allowance, account. */
async function Mine() {
  const session = await getSession()
  if (!session) redirect("/start?next=%2Fsettings")
  const t = await getTranslations("Settings")
  const ta = await getTranslations("Auth")
  const user = session.user as typeof session.user & { isAnonymous?: boolean | null }
  const guest = Boolean(user.isAnonymous)
  const [[prefs], used, links, self, [account]] = await Promise.all([
    db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, user.id)),
    usageToday(user.id),
    sharesOf(user.id, t("untitled")),
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
            }}
          />
        </section>
      ) : null}

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
      </section>

      <section className={card}>
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[17px]">{t("links")}</h2>
          <p className="text-sm text-text-3">{t("linksHint")}</p>
        </div>
        <ShareLinks items={links} />
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
