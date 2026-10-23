import { LIVE } from "@najimi/config"
import { db, pg, schema } from "@najimi/db"
import type { NotificationKind, PushPrefs } from "@najimi/db/schema"
import { env } from "@najimi/env/server"
import type { LiveNotice } from "@najimi/live"
import { and, eq } from "drizzle-orm"
import webpush from "web-push"

/*
 * Push (W24): every piece of someone's news already goes through the live pipe as a
 * `notification` on their own topic, so the worker listens there once and sends each one to the
 * phones they turned push on for — in their words, opening the right screen, and only the kinds
 * they want. A subscription the push service says is gone is forgotten.
 */

const GROUP: Record<NotificationKind, keyof PushPrefs> = {
  follow: "messages",
  joined: "messages",
  mention: "messages",
  message: "messages",
  invite: "messages",
  played: "games",
  drop: "games",
  game: "games",
  booking: "plans",
  tuneup: "feeds",
  export: "feeds",
  call: "messages",
}

type Push = { title: string; body: string; url: string; tag?: string }

async function compose(n: typeof schema.notifications.$inferSelect): Promise<Push> {
  const [actor] = n.actorId
    ? await db
        .select({ name: schema.people.name, username: schema.user.displayUsername })
        .from(schema.people)
        .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
        .where(and(eq(schema.people.ownerId, n.actorId), eq(schema.people.isSelf, true)))
    : []
  const [chat] = n.chatId
    ? await db
        .select({ name: schema.chats.name, kind: schema.chats.kind })
        .from(schema.chats)
        .where(eq(schema.chats.id, n.chatId))
    : []
  const who = actor?.name ?? "Someone"
  const data = n.data as Record<string, unknown>
  const text = typeof data.text === "string" ? data.text : ""
  const room = chat?.name ?? (typeof data.name === "string" ? data.name : "")
  const inChat = n.chatId ? `/c/${n.chatId}` : "/people"
  switch (n.kind) {
    case "message":
      return {
        title: chat?.kind === "circle" && room ? `${who} · ${room}` : who,
        body: text,
        url: inChat,
        tag: `chat:${n.chatId}`,
      }
    case "mention":
      return { title: `${who} mentioned you`, body: text, url: inChat }
    case "follow":
      return {
        title: who,
        body: "followed you",
        url: actor?.username ? `/u/${actor.username}` : "/people",
      }
    case "joined":
      return { title: room || "Your circle", body: `${who} joined`, url: inChat }
    case "invite":
      return { title: `${who} invited you`, body: room, url: inChat }
    case "played":
      return {
        title: `${who} played your game`,
        body: typeof data.score === "number" ? `They scored ${data.score}` : text,
        url: typeof data.token === "string" ? `/play/${data.token}` : "/people",
      }
    case "drop":
      return { title: "Today's drop is up", body: room, url: inChat, tag: `drop:${n.chatId}` }
    case "game":
      return {
        title: room || "Your circle",
        body: `${who} dealt ${typeof data.title === "string" ? data.title : "a game"}`,
        url: typeof data.token === "string" ? `/play/${data.token}` : inChat,
      }
    case "booking":
      return {
        title: "Najimi",
        body: text,
        url:
          typeof data.businessId === "string"
            ? `/business/${data.businessId}`
            : typeof data.bookingId === "string" && !n.chatId
              ? `/pay/${data.bookingId}/done`
              : inChat,
      }
    case "tuneup":
      return { title: "Najimi", body: text, url: "/connect", tag: "tuneup" }
    case "call":
      return {
        title: room || "Najimi",
        body: text,
        url: `${inChat}?call=1`,
        tag: `call-${n.chatId ?? ""}`,
      }
    case "export":
      return {
        title: "Najimi",
        body: text,
        url: `/connect?bring=${typeof data.platform === "string" ? data.platform : ""}`,
        tag: `export-${typeof data.platform === "string" ? data.platform : ""}`,
      }
  }
}

async function deliver(notice: LiveNotice) {
  const [event] = await db
    .select()
    .from(schema.liveEvents)
    .where(eq(schema.liveEvents.id, notice.id))
  if (event?.type !== "notification" || typeof event.data.id !== "string") return
  const [n] = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.id, event.data.id))
  if (!n) return
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, n.userId))
  if (!subs.length) return
  const [prefs] = await db
    .select({ push: schema.userPrefs.push })
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, n.userId))
  if (prefs && prefs.push[GROUP[n.kind]] === false) return
  const payload = JSON.stringify(await compose(n))
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 6, urgency: n.kind === "message" ? "high" : "normal" },
        )
        await db
          .update(schema.pushSubscriptions)
          .set({ lastOkAt: new Date() })
          .where(eq(schema.pushSubscriptions.id, s.id))
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410)
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id))
        else console.error("[push]", status ?? (error as Error).message)
      }
    }),
  )
}

/** Listens for people's news and pushes it (when the VAPID pair is set). */
export async function startPush() {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.log("[push] off (no VAPID keys)")
    return
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)
  await pg.listen(LIVE.channel, (payload) => {
    let notice: LiveNotice
    try {
      notice = JSON.parse(payload) as LiveNotice
    } catch {
      return
    }
    if (!notice.topic.startsWith("user:")) return
    void deliver(notice).catch((error) => console.error("[push] deliver", error))
  })
  console.log("[push] listening")
}
