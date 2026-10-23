import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import {
  digestEmail,
  type EmailPick,
  emailReady,
  sendEmail,
  unsubscribeUrl,
  welcomeEmail,
} from "@najimi/email"
import { env } from "@najimi/env/server"
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notLike,
  or,
  sql,
} from "drizzle-orm"

/*
 * Email that isn't news (S23), checked every quarter hour:
 *  - the welcome, once a person's taste has been read and Najimi knows a real address for them
 *    (guests have none; signing in later still gets them one);
 *  - "your week in taste", Sunday at six in the evening in their own time zone, one a week, only
 *    for those who want it.
 * Each send is claimed in the database first, so a restart or a second round never sends twice.
 */

const ROUND = 25
const WEEK_MS = 7 * 24 * 3600_000
/** The welcome's three picks come from these, in this order, when the taste has them. */
const WELCOME_KINDS = ["artist", "movie", "place", "tv_show", "book", "podcast", "brand"]
const DIGEST = { weekday: "Sun", hour: 18 }

const site = () => env.BETTER_AUTH_URL.replace(/\/$/, "")
const firstName = (name: string | null | undefined) =>
  (name ?? "").trim().split(/\s+/)[0] || "there"

const asPick = (p: StoredPick): EmailPick => ({
  name: p.name,
  image: p.image,
  because: p.because?.name ?? null,
})

/** People with a real address (not a guest, not a stand-in) and their self profile and taste. */
function members() {
  return db
    .select({
      userId: schema.user.id,
      email: schema.user.email,
      personId: schema.people.id,
      name: schema.people.name,
      words: schema.tastes.words,
      picks: schema.tastes.picks,
      prefs: schema.userPrefs,
    })
    .from(schema.user)
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.user.id), eq(schema.people.isSelf, true)),
    )
    .innerJoin(schema.tastes, eq(schema.tastes.personId, schema.people.id))
    .innerJoin(schema.userPrefs, eq(schema.userPrefs.userId, schema.user.id))
}

const real = and(
  or(isNull(schema.user.isAnonymous), eq(schema.user.isAnonymous, false)),
  notLike(schema.user.email, "%.invalid"),
  isNotNull(schema.tastes.computedAt),
)

async function welcomes() {
  const due = await members()
    .where(and(real, isNull(schema.userPrefs.welcomedAt)))
    .limit(ROUND)
  for (const m of due) {
    // Claimed first: only the round that sets it sends.
    const [claimed] = await db
      .update(schema.userPrefs)
      .set({ welcomedAt: new Date() })
      .where(and(eq(schema.userPrefs.userId, m.userId), isNull(schema.userPrefs.welcomedAt)))
      .returning({ userId: schema.userPrefs.userId })
    if (!claimed) continue
    const words = [
      ...new Set([
        ...(m.words?.aesthetic ?? []),
        ...(m.words?.lifestyle ?? []),
        ...(m.words?.style ?? []),
      ]),
    ].slice(0, 6)
    const picks = WELCOME_KINDS.map((k) => m.picks?.[k]?.[0])
      .filter((p): p is StoredPick => Boolean(p))
      .slice(0, 3)
      .map(asPick)
    const mail = welcomeEmail({ name: firstName(m.name), words, picks, open: `${site()}/feed` })
    await sendEmail({ to: m.email, ...mail, idempotencyKey: `welcome:${m.userId}` }).catch((e) =>
      console.error("[email] welcome", (e as Error).message),
    )
  }
}

/** Whether it's Sunday six o'clock (the hour) where this person lives. */
function digestHour(tz: string | null) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz ?? "UTC",
      weekday: "short",
      hour: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date())
    const part = (type: string) => parts.find((p) => p.type === type)?.value
    return part("weekday") === DIGEST.weekday && Number(part("hour")) === DIGEST.hour
  } catch {
    return false
  }
}

/** "Sat 24 Oct, 5pm" (or 7:30pm) in their own time. */
function shortWhen(at: Date, tz: string | null) {
  const zone = tz ?? "UTC"
  const day = at.toLocaleDateString("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  })
  const time = at
    .toLocaleTimeString("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(":00", "")
    .replace(/\s?([AP])M/i, (_, half: string) => `${half.toLowerCase()}m`)
  return `${day}, ${time}`
}

async function digests() {
  const now = Date.now()
  const due = await members()
    .where(
      and(
        real,
        sql`(${schema.userPrefs.emailPrefs}->>'weekly')::boolean is not false`,
        or(
          isNull(schema.userPrefs.digestAt),
          lt(schema.userPrefs.digestAt, new Date(now - WEEK_MS + 3600_000)),
        ),
      ),
    )
    .limit(200)
  for (const m of due.filter((d) => digestHour(d.prefs.tz)).slice(0, ROUND)) {
    const [claimed] = await db
      .update(schema.userPrefs)
      .set({ digestAt: new Date() })
      .where(
        and(
          eq(schema.userPrefs.userId, m.userId),
          or(
            isNull(schema.userPrefs.digestAt),
            lt(schema.userPrefs.digestAt, new Date(now - WEEK_MS + 3600_000)),
          ),
        ),
      )
      .returning({ userId: schema.userPrefs.userId })
    if (!claimed) continue
    const weekAgo = new Date(now - WEEK_MS)
    const inAWeek = new Date(now + WEEK_MS)
    const [all, loved, bookings, plans, followers, circles] = await Promise.all([
      db
        .select({ qlooId: schema.loves.qlooId })
        .from(schema.loves)
        .where(eq(schema.loves.personId, m.personId)),
      db
        .select({
          qlooId: schema.loves.qlooId,
          name: schema.loves.name,
          image: schema.loves.imageUrl,
        })
        .from(schema.loves)
        .where(and(eq(schema.loves.personId, m.personId), gte(schema.loves.createdAt, weekAgo)))
        .orderBy(desc(schema.loves.createdAt))
        .limit(3),
      db
        .select({ title: schema.bookings.title, startsAt: schema.bookings.startsAt })
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.ownerId, m.userId),
            inArray(schema.bookings.status, ["confirmed", "paid"]),
            gt(schema.bookings.startsAt, new Date(now)),
            lte(schema.bookings.startsAt, inAWeek),
          ),
        )
        .limit(3),
      db
        .select({ title: schema.plans.title, startsAt: schema.plans.startsAt })
        .from(schema.plans)
        .where(
          and(
            eq(schema.plans.ownerId, m.userId),
            gt(schema.plans.startsAt, new Date(now)),
            lte(schema.plans.startsAt, inAWeek),
          ),
        )
        .limit(3),
      db
        .select({ name: schema.people.name })
        .from(schema.follows)
        .innerJoin(
          schema.people,
          and(eq(schema.people.ownerId, schema.follows.followerId), eq(schema.people.isSelf, true)),
        )
        .where(and(eq(schema.follows.followeeId, m.userId), gte(schema.follows.createdAt, weekAgo)))
        .limit(4),
      db
        .select({ chatId: schema.chatMembers.chatId })
        .from(schema.chatMembers)
        .innerJoin(schema.chats, eq(schema.chats.id, schema.chatMembers.chatId))
        .where(and(eq(schema.chatMembers.userId, m.userId), eq(schema.chats.kind, "circle")))
        .limit(1),
    ])
    // One new thing a week, from a different kind each week, never one they already love.
    const kinds = Object.keys(m.picks ?? {}).filter((k) => (m.picks?.[k] ?? []).length)
    const week = Math.floor(now / WEEK_MS)
    const kind = kinds.length ? kinds[week % kinds.length] : null
    const loves = new Set(all.map((l) => l.qlooId))
    const pick = kind
      ? ((m.picks?.[kind] ?? []).find((p, i) => i >= week % 3 && !loves.has(p.qlooId)) ?? null)
      : null
    const coming = [...bookings, ...plans]
      .filter((c): c is { title: string; startsAt: Date } => Boolean(c.startsAt))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, 3)
      .map((c) => ({ title: c.title, when: shortWhen(c.startsAt, m.prefs.tz) }))
    const nudge = circles.length
      ? {
          text: "Ask Najimi in your circle where to go this week: it scores every pick for everyone.",
          label: "Open your circle",
          url: `${site()}/c/${circles[0]?.chatId}`,
        }
      : {
          text: "Start a circle with your friends, and Najimi plans the night for all of you.",
          label: "Start a circle",
          url: `${site()}/people`,
        }
    const mail = digestEmail({
      name: firstName(m.name),
      loved: loved.map((l) => ({ name: l.name, image: l.image })),
      pick: pick ? asPick(pick) : null,
      coming,
      followers: followers.map((f) => firstName(f.name)),
      nudge,
      open: `${site()}/feed`,
      unsubscribe: unsubscribeUrl(m.userId, "weekly"),
    })
    await sendEmail({ to: m.email, ...mail, idempotencyKey: `digest:${m.userId}:${week}` }).catch(
      (e) => console.error("[email] digest", (e as Error).message),
    )
  }
}

export async function emailRound() {
  if (!emailReady()) return
  await welcomes()
  await digests()
}
