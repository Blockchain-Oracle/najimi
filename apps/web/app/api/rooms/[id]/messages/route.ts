import { charge, ownsUploads, publishMessage, roomMessages, toUI } from "@najimi/agent/server"
import { DEFAULT_LOCALE, ROOMS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { and, eq, gte, isNull } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { chatExists, createAgentRoom, ownedChat } from "@/lib/chat/store"
import { isLocale } from "@/lib/i18n"
import { selfOf } from "@/lib/people"
import { allow } from "@/lib/rate-limit"
import { notify } from "@/lib/social"

/** Calling Najimi in a room: "@najimi", or a message that starts with its name. */
const MENTION = /(^|\s)@najimi\b|^\s*najimi\b/i

const UPLOAD_URL = /^\/api\/media\/upload\/([0-9a-f-]{36})\?v=(original|display)$/

const input = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  text: z.string().trim().max(8000),
  files: z
    .array(z.object({ url: z.string().regex(UPLOAD_URL) }))
    .max(6)
    .default([]),
  screen: z
    .object({
      where: z.string().max(40),
      label: z.string().max(300),
      qlooId: z.string().max(64).optional(),
      type: z.string().max(64).optional(),
    })
    .optional(),
  /** The writer's time zone (IANA), so "9pm" in a plan means their 9pm. */
  tz: z
    .string()
    .regex(/^[A-Za-z_+\-/0-9]{1,64}$/)
    .optional(),
})

const localeFrom = (request: Request) => {
  const match = /(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")
  return match?.[1] && isLocale(match[1]) ? match[1] : DEFAULT_LOCALE
}

/** A page of a room's messages, oldest first: the newest, or those before `before` (ms). */
export async function GET(request: Request, ctx: RouteContext<"/api/rooms/[id]/messages">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  const before = Number(new URL(request.url).searchParams.get("before")) || null
  const messages = await roomMessages(chat.id, {
    limit: ROOMS.pageSize,
    before: before ? new Date(before) : undefined,
  })
  return json({ messages })
}

/**
 * Says something in a room. A new id starts a conversation with Najimi. The message is saved and
 * sent to everyone in the room; Najimi's turn runs in the worker and streams to them all.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]/messages">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const user = auth.session.user
  const chatId = z.uuid().safeParse((await ctx.params).id).data
  if (!chatId) return fail("Unknown room", 404)
  if (!allow(`room:${user.id}`, ROOMS.perMinute, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { id, text, files, screen, tz } = parsed.data
  if (!text && !files.length) return fail("Say something first", 400)

  const person = await selfOf(user.id)
  if (!person) return fail("Tell Najimi who you are first", 409)
  let chat = await ownedChat(user.id, chatId)
  if (!chat) {
    if (await chatExists(chatId)) return fail("Unknown room", 404)
    const [prefs] = await db
      .select()
      .from(schema.userPrefs)
      .where(eq(schema.userPrefs.userId, user.id))
    chat = await createAgentRoom({
      id: chatId,
      userId: user.id,
      personId: person.id,
      locale: localeFrom(request),
      mode: prefs?.mode ?? "ask",
    })
    if (!chat) return fail("Couldn't start the chat", 500)
  }
  const uploadIds = files.flatMap((f) => UPLOAD_URL.exec(f.url)?.[1] ?? [])
  if (!(await ownsUploads(user.id, uploadIds))) return fail("Unknown photo", 404)
  if (chat.status === "generating") return fail("Najimi is still answering", 409)

  // Najimi answers in its own conversations, and in a circle or a DM when someone calls it
  // ("@najimi", "Najimi, …"); a turn takes from today's allowance.
  const guest = Boolean((user as { isAnonymous?: boolean | null }).isAnonymous)
  const answers = chat.kind === "agent" || MENTION.test(text)
  if (answers && !(await charge(user.id, guest, "turns")))
    return fail("That's all the chat for today. Come back tomorrow, or sign in for more.", 429)

  const parts = [
    ...files.map((f) => ({
      type: "file" as const,
      mediaType: "image/jpeg",
      url: f.url,
      filename: "photo.jpg",
    })),
    ...(text ? [{ type: "text" as const, text }] : []),
  ]
  const [row] = await db
    .insert(schema.messages)
    .values({
      id,
      chatId: chat.id,
      role: "user",
      authorId: user.id,
      parts,
      metadata: screen || tz ? { ...(screen ? { screen } : {}), ...(tz ? { tz } : {}) } : null,
    })
    .onConflictDoNothing()
    .returning()
  // A resent message (a retry after a dropped connection) is already there.
  if (!row) return json({ ok: true, chatId: chat.id })
  await publishMessage(chat.id, toUI(row))
  await db
    .update(schema.chats)
    .set({ lastActiveAt: new Date() })
    .where(eq(schema.chats.id, chat.id))
  if (answers) await enqueue("agentTurn", { chatId: chat.id }, chat.id)
  // The other person in a DM hears about it.
  if (chat.kind === "dm") {
    const others = await db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(eq(schema.chatMembers.chatId, chat.id))
    for (const o of others)
      if (o.userId !== user.id)
        await notify({
          userId: o.userId,
          kind: "message",
          actorId: user.id,
          chatId: chat.id,
          data: { text: text.slice(0, 120) },
        })
  }
  // In a circle, the others hear about it too — once per stretch of talk, not every line.
  if (chat.kind === "circle") {
    const members = await db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(eq(schema.chatMembers.chatId, chat.id))
    const since = new Date(Date.now() - ROOMS.notifyQuietMs)
    for (const m of members) {
      if (m.userId === user.id) continue
      const [recent] = await db
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, m.userId),
            eq(schema.notifications.chatId, chat.id),
            eq(schema.notifications.kind, "message"),
            isNull(schema.notifications.readAt),
            gte(schema.notifications.createdAt, since),
          ),
        )
        .limit(1)
      if (recent) continue
      await notify({
        userId: m.userId,
        kind: "message",
        actorId: user.id,
        chatId: chat.id,
        data: { text: text.slice(0, 120), name: chat.name },
      })
    }
  }
  return json({ ok: true, chatId: chat.id }, 202)
}
