import { usageToday } from "@najimi/agent/server"
import { ALLOWANCE } from "@najimi/config"
import { connectionsOf } from "@najimi/connectors/sessions"
import { db, schema } from "@najimi/db"
import { and, count, eq, gte, sql } from "drizzle-orm"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LanguageMenu } from "@/components/language-menu"
import { AuraFace } from "@/components/people/person-row"
import { ProfileForm } from "@/components/people/profile-form"
import { BlockedPeople } from "@/components/settings/blocked-people"
import { DeleteData } from "@/components/settings/delete-data"
import { ModePicker } from "@/components/settings/mode-picker"
import { PhoneSettings } from "@/components/settings/phone-settings"
import { PushSettings } from "@/components/settings/push-settings"
import { ProfileRow, SettingsGroup } from "@/components/settings/settings-list"
import { ShareLinks } from "@/components/settings/share-links"
import { linksOf } from "@/lib/links"
import { selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"

/** Videos are switched off (MEDIA.video.enabled), so their counter isn't shown. */
const COUNTERS = ["turns", "images", "calls", "holds"] as const
const PLATFORM_NAMES: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
}

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

/** Everything that depends on who's signed in, as grouped rows. */
async function Mine() {
  const session = await getSession()
  if (!session) redirect("/start?next=%2Fsettings")
  const t = await getTranslations("Settings")
  const ta = await getTranslations("Auth")
  const tp = await getTranslations("Profile")
  const tc = await getTranslations("Chat")
  const user = session.user as typeof session.user & { isAnonymous?: boolean | null }
  const guest = Boolean(user.isAnonymous)
  const [[prefs], used, spent, links, self, [account], connections, [blocked], [devices]] =
    await Promise.all([
      db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, user.id)),
      usageToday(user.id),
      spentThisMonth(user.id),
      linksOf(user.id),
      selfOf(user.id),
      db
        .select({ username: schema.user.displayUsername })
        .from(schema.user)
        .where(eq(schema.user.id, user.id)),
      connectionsOf(user.id),
      db.select({ n: count() }).from(schema.blocks).where(eq(schema.blocks.blockerId, user.id)),
      db
        .select({ n: count() })
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, user.id)),
    ])
  const limits = guest ? ALLOWANCE.guest : ALLOWANCE.member
  const mode = prefs?.mode ?? "ask"
  const agentsOn = connections.reduce(
    (n, c) => n + Number(c.autopilot) + Number(c.likes) + Number(c.posts !== "off"),
    0,
  )
  const visibility = self?.visibility ?? "public"
  // Guests and TikTok sign-ins carry a stand-in address (…invalid), not one to show.
  const email = user.email.endsWith(".invalid") ? null : user.email

  return (
    <>
      {self ? (
        <ProfileRow
          face={<AuraFace person={self} size="md" />}
          name={self.name}
          handle={account?.username ?? null}
          sheet={{
            title: t("profile"),
            body: (
              <ProfileForm
                part="about"
                person={{
                  id: self.id,
                  name: self.name,
                  city: self.city,
                  bio: self.bio,
                  visibility: self.visibility,
                  radar: self.radar,
                }}
              />
            ),
          }}
        />
      ) : null}

      <SettingsGroup
        title={t("groups.you")}
        rows={
          self
            ? [
                {
                  id: "privacy",
                  icon: "privacy",
                  label: tp("whoSees"),
                  value: tp(
                    visibility === "public"
                      ? "public"
                      : visibility === "friends"
                        ? "friends"
                        : "private",
                  ),
                  sheet: {
                    title: tp("whoSees"),
                    body: (
                      <ProfileForm
                        part="privacy"
                        person={{
                          id: self.id,
                          name: self.name,
                          city: self.city,
                          bio: self.bio,
                          visibility: self.visibility,
                          radar: self.radar,
                        }}
                      />
                    ),
                  },
                },
              ]
            : []
        }
      >
        <LanguageMenu variant="row" />
      </SettingsGroup>

      <SettingsGroup
        title={t("groups.najimi")}
        rows={[
          {
            id: "mode",
            icon: "mode",
            label: t("mode"),
            value: tc(`modes.${mode}` as "modes.ask"),
            sheet: { title: t("mode"), hint: t("modeHint"), body: <ModePicker initial={mode} /> },
          },
          {
            id: "agents",
            icon: "agents",
            label: t("agents"),
            value: agentsOn ? t("agentsOn", { count: agentsOn }) : t("off"),
            href: "/agents",
          },
          {
            id: "notifications",
            icon: "notifications",
            label: t("notifications"),
            value: devices?.n ? t("on") : t("off"),
            sheet: {
              title: t("notifications"),
              hint: t("notificationsHint"),
              body: <PushSettings />,
            },
          },
          // Najimi on your phone calls: members only (it needs a number that's yours).
          ...(guest
            ? []
            : [
                {
                  id: "phone",
                  icon: "phone" as const,
                  label: t("phone"),
                  value: prefs?.phone
                    ? prefs.phoneConfirmedAt
                      ? t("on")
                      : t("phoneWaiting")
                    : null,
                  sheet: { title: t("phone"), hint: t("phoneHint"), body: <PhoneSettings /> },
                },
              ]),
        ]}
      />

      <SettingsGroup
        title={t("groups.elsewhere")}
        rows={[
          {
            id: "feeds",
            icon: "feeds",
            label: t("feeds"),
            value: connections.length
              ? connections.map((c) => PLATFORM_NAMES[c.platform] ?? c.platform).join(" · ")
              : null,
            href: "/connect",
          },
          {
            id: "links",
            icon: "links",
            label: t("links"),
            value: links.length ? String(links.length) : null,
            sheet: {
              title: t("links"),
              hint: t("linksHint"),
              body: (
                <ShareLinks
                  items={links.map(({ kind, id, title, path }) => ({ kind, id, title, path }))}
                />
              ),
            },
          },
          {
            id: "blocked",
            icon: "blocked",
            label: t("blocked"),
            value: blocked?.n ? String(blocked.n) : null,
            sheet: { title: t("blocked"), body: <BlockedPeople /> },
          },
        ]}
      />

      <SettingsGroup
        title={t("groups.today")}
        rows={[
          {
            id: "today",
            icon: "today",
            label: t("today"),
            value: t("todayValue", { used: used.turns, limit: limits.turns }),
            sheet: {
              title: t("today"),
              hint: guest ? t("todayGuest") : t("todayMember"),
              body: (
                <div className="flex flex-col gap-4">
                  {COUNTERS.map((c) => (
                    <Meter key={c} label={t(`counters.${c}`)} used={used[c]} limit={limits[c]} />
                  ))}
                  <p className="text-sm text-text-3">
                    {t("spent", { amount: spent < 0.01 ? "<$0.01" : `$${spent.toFixed(2)}` })}
                  </p>
                </div>
              ),
            },
          },
        ]}
      />

      <SettingsGroup
        title={t("groups.account")}
        rows={[
          {
            id: "account",
            icon: "account",
            label: t("account"),
            value: guest ? ta("guest") : (email ?? t("signedIn")),
            sheet: {
              title: t("account"),
              body: (
                <div className="flex flex-col gap-2 text-[15px]">
                  <p>{guest ? ta("guest") : email ? ta("signedInAs", { email }) : t("signedIn")}</p>
                  {guest ? <p className="text-sm text-text-3">{ta("hint")}</p> : null}
                </div>
              ),
            },
          },
          { id: "privacyPolicy", icon: "legal", label: t("privacyPolicy"), href: "/privacy" },
          { id: "terms", icon: "legal", label: t("terms"), href: "/terms" },
          {
            id: "delete",
            icon: "delete",
            label: t("deleteHeading"),
            danger: true,
            sheet: { title: t("deleteHeading"), hint: t("deleteHint"), body: <DeleteData /> },
          },
        ]}
      />
    </>
  )
}

/** Settings: grouped one-line rows (you, Najimi, your taste elsewhere, today, account). */
export default async function SettingsPage() {
  const t = await getTranslations("Settings")
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <h1 className="font-title text-title-sm">{t("title")}</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card/10" aria-busy />}>
        <Mine />
      </Suspense>
    </div>
  )
}
