import { draftPost } from "@najimi/agent/server"
import { SOCIAL } from "@najimi/config"
import { instagram } from "@najimi/connectors/bridge"
import { PlatformError } from "@najimi/connectors/errors"
import {
  type Connection,
  connectionOf,
  noteConnection,
  secretOf,
} from "@najimi/connectors/sessions"
import { dayIn, tickTuneUp, tuneUpFor } from "@najimi/connectors/today"
import { xFollow, xLikeLatest, xPost } from "@najimi/connectors/x"
import { db, schema } from "@najimi/db"
import type { TuneUpItem } from "@najimi/db/schema"
import { enqueue, type Payload } from "@najimi/jobs"
import { publish, topic } from "@najimi/live"
import { and, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm"

/*
 * The agents that act on someone's own accounts (W15), each switched on by them, with their own
 * session, slowly (a random pause between each), within daily caps well under the platform's own,
 * and each action reported live as it happens:
 * - Follow: each morning, today's tune-up accounts.
 * - Like: each morning, the newest post of accounts in their taste (today's tune-up and the ones
 *   Najimi followed for them).
 * - Post: once a week, a post from their week in taste; it waits for their yes, or posts itself
 *   when they said "just do it" (X: text; Instagram needs a picture, so it stays a draft there).
 * The first sign the platform objects stops the run and pauses that platform for a day; a session
 * the platform ended asks them to reconnect.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const between = ([low, high]: readonly [number, number]) =>
  (low + Math.random() * (high - low)) * 1000
const NAMES = { x: "X", instagram: "Instagram", youtube: "YouTube" } as const

type Platform = Payload<"socialRun">["platform"]

async function tell(userId: string, text: string) {
  const [note] = await db
    .insert(schema.notifications)
    .values({ userId, kind: "tuneup", data: { text } })
    .returning({ id: schema.notifications.id })
  await publish(topic.user(userId), "notification", { id: note?.id, kind: "tuneup" })
}

const live = (userId: string, data: Record<string, unknown>) =>
  publish(topic.user(userId), "social", data)

/** Follows one account with the connection; returns where it lives. */
async function follow(c: Connection, item: TuneUpItem, platform: Platform): Promise<string> {
  const target = item.target ?? item.handle
  if (!target) throw new PlatformError("Nothing to follow", "not_found")
  if (platform === "x") return (await xFollow(secretOf(c), target)).url
  if (platform === "instagram") {
    const settings = JSON.parse(secretOf(c)) as Record<string, unknown>
    const done = await instagram.act(settings, "follow", target)
    await noteConnection(c, { ok: true, session: JSON.stringify(done.settings) })
    return done.url
  }
  throw new PlatformError("YouTube isn't connected yet", "platform")
}

export async function socialRun({ userId, platform, day }: Payload<"socialRun">) {
  let c = await connectionOf(userId, platform)
  if (!c || (!c.autopilot && !c.likes) || c.status !== "active") return
  if (c.pausedUntil && c.pausedUntil > new Date()) return
  const today = await tuneUpFor(userId, day)
  if (!today) return
  if (!c.autopilot) return likeRun(c, userId, platform, today.items)
  const todo = today.items.filter(
    (i) => i.platform === platform && i.kind === "follow" && !i.done && (i.target ?? i.handle),
  )
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.socialActions)
    .where(
      and(
        eq(schema.socialActions.userId, userId),
        eq(schema.socialActions.platform, platform),
        eq(schema.socialActions.kind, "follow"),
        eq(schema.socialActions.status, "done"),
        gte(schema.socialActions.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    )
  let room = Math.min(todo.length, SOCIAL.pacing[platform].followsPerDay - count)
  if (room <= 0) return
  await live(userId, { platform, state: "started", items: todo.slice(0, room).map((i) => i.id) })

  const followed: string[] = []
  for (const item of todo) {
    if (room <= 0) break
    await live(userId, { platform, itemId: item.id, state: "running" })
    try {
      const url = await follow(c, item, platform)
      await db.insert(schema.socialActions).values({
        userId,
        platform,
        kind: "follow",
        target: item.target ?? item.handle ?? item.label,
        label: item.label,
        itemId: item.id,
        status: "done",
        url,
      })
      await tickTuneUp(today.id, [item.id], true)
      followed.push(item.label)
      room--
      await live(userId, { platform, itemId: item.id, state: "done", url })
    } catch (e) {
      const error =
        e instanceof PlatformError ? e : new PlatformError("Something went wrong", "platform")
      await db.insert(schema.socialActions).values({
        userId,
        platform,
        kind: "follow",
        target: item.target ?? item.handle ?? item.label,
        label: item.label,
        itemId: item.id,
        status: "failed",
        detail: error.message,
      })
      await live(userId, { platform, itemId: item.id, state: "failed", error: error.message })
      if (error.expired) {
        await noteConnection(c, {
          ok: false,
          error: error.message,
          status: error.code === "locked" ? "locked" : "expired",
        })
        await tell(userId, `${NAMES[platform]} needs you to connect again: ${error.message}`)
        break
      }
      if (error.backOff) {
        await db
          .update(schema.connectorSessions)
          .set({
            pausedUntil: new Date(Date.now() + SOCIAL.backoffHours * 3_600_000),
            lastError: error.message,
          })
          .where(eq(schema.connectorSessions.id, c.id))
        await tell(userId, `Najimi paused ${NAMES[platform]} for a day: ${error.message}`)
        break
      }
    }
    // The session may have changed (Instagram refreshes its settings); read it again.
    c = (await connectionOf(userId, platform)) ?? c
    if (room > 0) await sleep(between(SOCIAL.pacing[platform].gapSeconds))
  }
  await live(userId, { platform, state: "finished", followed: followed.length })
  if (followed.length)
    await tell(
      userId,
      `Najimi followed ${followed.length} on ${NAMES[platform]} for you: ${followed.join(", ")}`,
    )
  const after = await connectionOf(userId, platform)
  if (
    after?.likes &&
    after.status === "active" &&
    !(after.pausedUntil && after.pausedUntil > new Date())
  )
    await likeRun(after, userId, platform, today.items)
}

/** The Like agent: the newest post of accounts in their taste, within the day's cap. */
async function likeRun(c: Connection, userId: string, platform: Platform, items: TuneUpItem[]) {
  if (platform !== "x" && platform !== "instagram") return
  const since = new Date(Date.now() - 86_400_000)
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.socialActions)
    .where(
      and(
        eq(schema.socialActions.userId, userId),
        eq(schema.socialActions.platform, platform),
        eq(schema.socialActions.kind, "like"),
        eq(schema.socialActions.status, "done"),
        gte(schema.socialActions.createdAt, since),
      ),
    )
  let room = SOCIAL.pacing[platform].likesPerDay - count
  if (room <= 0) return
  const followed = await db
    .select({ target: schema.socialActions.target })
    .from(schema.socialActions)
    .where(
      and(
        eq(schema.socialActions.userId, userId),
        eq(schema.socialActions.platform, platform),
        eq(schema.socialActions.kind, "follow"),
        eq(schema.socialActions.status, "done"),
        gte(schema.socialActions.createdAt, new Date(Date.now() - 14 * 86_400_000)),
      ),
    )
  const likedToday = new Set(
    (
      await db
        .select({ target: schema.socialActions.target })
        .from(schema.socialActions)
        .where(
          and(
            eq(schema.socialActions.userId, userId),
            eq(schema.socialActions.platform, platform),
            eq(schema.socialActions.kind, "like"),
            gte(schema.socialActions.createdAt, since),
          ),
        )
    ).map((r) => r.target.toLowerCase()),
  )
  const handles = [
    ...new Set(
      [
        ...items.filter((i) => i.platform === platform).map((i) => i.target ?? i.handle),
        ...followed.map((f) => f.target),
      ]
        .filter((h): h is string => Boolean(h) && /^@?[A-Za-z0-9_.]{1,30}$/.test(h as string))
        .map((h) => h.replace(/^@/, "").toLowerCase()),
    ),
  ].filter((h) => !likedToday.has(h))
  const liked: string[] = []
  for (const handle of handles) {
    if (room <= 0) break
    try {
      let url: string | null = null
      if (platform === "x") url = (await xLikeLatest(secretOf(c), handle))?.url ?? null
      else {
        const done = await instagram.act(
          JSON.parse(secretOf(c)) as Record<string, unknown>,
          "like_latest",
          handle,
        )
        await noteConnection(c, { ok: true, session: JSON.stringify(done.settings) })
        url = done.ok ? done.url : null
      }
      if (!url) continue
      await db.insert(schema.socialActions).values({
        userId,
        platform,
        kind: "like",
        target: handle,
        label: `@${handle}`,
        status: "done",
        url,
      })
      await live(userId, { platform, kind: "like", state: "done", url })
      liked.push(`@${handle}`)
      room--
    } catch (e) {
      const error =
        e instanceof PlatformError ? e : new PlatformError("Something went wrong", "platform")
      await db.insert(schema.socialActions).values({
        userId,
        platform,
        kind: "like",
        target: handle,
        label: `@${handle}`,
        status: "failed",
        detail: error.message,
      })
      if (error.expired || error.backOff) {
        await db
          .update(schema.connectorSessions)
          .set(
            error.expired
              ? { status: error.code === "locked" ? "locked" : "expired", lastError: error.message }
              : {
                  pausedUntil: new Date(Date.now() + SOCIAL.backoffHours * 3_600_000),
                  lastError: error.message,
                },
          )
          .where(eq(schema.connectorSessions.id, c.id))
        await tell(userId, `Najimi stopped liking on ${NAMES[platform]}: ${error.message}`)
        break
      }
    }
    c = (await connectionOf(userId, platform)) ?? c
    if (room > 0) await sleep(between(SOCIAL.pacing[platform].gapSeconds))
  }
  if (liked.length)
    await tell(
      userId,
      `Najimi liked ${liked.length} posts on ${NAMES[platform]} for you: ${liked.join(", ")}`,
    )
}

/** Local hour and weekday where someone is (their time zone, else UTC). */
function localNow(tz: string | null) {
  let zone = "UTC"
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz ?? "UTC" })
    zone = tz ?? "UTC"
  } catch {}
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date())
  return {
    hour: Number(parts.find((p) => p.type === "hour")?.value ?? 0),
    weekday: parts.find((p) => p.type === "weekday")?.value ?? "",
  }
}

/**
 * The Post agent, hourly: on each person's Sunday evening, one post from their week in taste. "Ask
 * me first" leaves it as a draft and tells them; "Just do it" posts it on X (Instagram needs a
 * picture, so it stays a draft there).
 */
export async function socialPosts() {
  const rows = await db
    .select()
    .from(schema.connectorSessions)
    .where(
      and(
        eq(schema.connectorSessions.mode, "own"),
        eq(schema.connectorSessions.status, "active"),
        ne(schema.connectorSessions.posts, "off"),
        inArray(schema.connectorSessions.platform, ["x", "instagram"]),
      ),
    )
  let drafted = 0
  for (const row of rows) {
    const now = localNow(row.tz)
    if (now.weekday !== SOCIAL.postDay || now.hour !== SOCIAL.postHour) continue
    if (row.pausedUntil && row.pausedUntil > new Date()) continue
    const platform = row.platform as "x" | "instagram"
    const [recent] = await db
      .select({ id: schema.postDrafts.id })
      .from(schema.postDrafts)
      .where(
        and(
          eq(schema.postDrafts.userId, row.userId),
          eq(schema.postDrafts.platform, platform),
          gte(schema.postDrafts.createdAt, new Date(Date.now() - 6 * 86_400_000)),
        ),
      )
    if (recent) continue
    const draft = await draftPost(row.userId, platform)
    if (!draft) continue
    drafted++
    if (row.posts === "auto" && platform === "x") {
      try {
        const c = await connectionOf(row.userId, platform)
        if (!c) continue
        const posted = await xPost(secretOf(c), draft.text)
        await db
          .update(schema.postDrafts)
          .set({ status: "posted", url: posted.url, postedAt: new Date() })
          .where(eq(schema.postDrafts.id, draft.id))
        await db.insert(schema.socialActions).values({
          userId: row.userId,
          platform,
          kind: "post",
          target: posted.id,
          label: draft.text.slice(0, 80),
          status: "done",
          url: posted.url,
        })
        await tell(row.userId, `Najimi posted on X for you: "${draft.text.slice(0, 80)}"`)
      } catch (e) {
        await db
          .update(schema.postDrafts)
          .set({ status: "failed", detail: (e as Error).message })
          .where(eq(schema.postDrafts.id, draft.id))
      }
    } else
      await tell(
        row.userId,
        `Your ${NAMES[platform]} post for the week is ready: tap to read it and post it.`,
      )
  }
  if (drafted) console.log(`[social] posts: ${drafted} drafted`)
}

/** Every hour: whoever has "Do it for me" on and whose local morning it is gets today's run. */
export async function socialMornings() {
  const rows = await db
    .select({
      userId: schema.connectorSessions.userId,
      platform: schema.connectorSessions.platform,
      tz: schema.connectorSessions.tz,
    })
    .from(schema.connectorSessions)
    .where(
      and(
        eq(schema.connectorSessions.mode, "own"),
        or(eq(schema.connectorSessions.autopilot, true), eq(schema.connectorSessions.likes, true)),
        eq(schema.connectorSessions.status, "active"),
        or(
          isNull(schema.connectorSessions.pausedUntil),
          lt(schema.connectorSessions.pausedUntil, new Date()),
        ),
      ),
    )
  let started = 0
  for (const row of rows) {
    if (row.platform !== "x" && row.platform !== "instagram") continue
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        hour: "numeric",
        hour12: false,
        timeZone: (() => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: row.tz ?? "UTC" })
            return row.tz ?? "UTC"
          } catch {
            return "UTC"
          }
        })(),
      }).format(new Date()),
    )
    if (hour !== SOCIAL.morningHour) continue
    await enqueue(
      "socialRun",
      { userId: row.userId, platform: row.platform, day: dayIn(row.tz) },
      `${row.userId}:${row.platform}`,
    )
    started++
  }
  console.log(`[social] mornings: ${started} run(s) started`)
}
