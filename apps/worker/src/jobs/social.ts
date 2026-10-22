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
import { xFollow } from "@najimi/connectors/x"
import { db, schema } from "@najimi/db"
import type { TuneUpItem } from "@najimi/db/schema"
import { enqueue, type Payload } from "@najimi/jobs"
import { publish, topic } from "@najimi/live"
import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm"

/*
 * "Do it for me" (W15): today's tune-up follows on one platform, done with the person's own
 * session, slowly (a random pause between each), within a daily cap well under the platform's
 * own, and each one reported live as it happens. The first sign the platform objects stops the
 * run and pauses that platform for a day; a session the platform ended asks them to reconnect.
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
  if (!c?.autopilot || c.status !== "active") return
  if (c.pausedUntil && c.pausedUntil > new Date()) return
  const today = await tuneUpFor(userId, day)
  if (!today) return
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
        eq(schema.connectorSessions.autopilot, true),
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
