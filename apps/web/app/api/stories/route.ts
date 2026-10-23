import { STORIES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"
import { activeCount, expiry, storiesTray } from "@/lib/stories"

const caption = z.string().trim().max(STORIES.captionMax).optional()
const thing = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.string().startsWith("urn:entity:"),
  name: z.string().trim().min(1).max(300),
  image: z.url().max(2000).nullable(),
})
// Songs play Apple's own previews and link to Apple Music; nothing else is played.
const song = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  preview: z.url().refine((u) => new URL(u).hostname.endsWith(".itunes.apple.com")),
  store: z.url().refine((u) => new URL(u).hostname === "music.apple.com"),
  artwork: z.url().max(2000).nullable(),
})

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("photo"), uploadId: z.uuid(), caption, song: song.optional() }),
  z.object({ kind: z.literal("video"), uploadId: z.uuid(), caption }),
  z.object({ kind: z.literal("song"), song, thing: thing.optional(), caption }),
  z.object({ kind: z.literal("pick"), thing, caption }),
  z.object({ kind: z.literal("plan"), planToken: z.string().min(6).max(40), caption }),
  z.object({
    kind: z.literal("wrapped"),
    wrappedToken: z.string().min(6).max(64),
    slide: z.number().int().min(1).max(5),
    caption,
  }),
])

/** Your tray: you and the people you follow who have a story up. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json({ tray: await storiesTray(auth.session.user.id) })
}

/** Posts a story for a day (a video is made phone-ready first). */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  if (!allow(`story:${userId}`, 12, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const s = parsed.data
  if ((await activeCount(userId)) >= STORIES.perPerson)
    return fail("That's a lot of stories for one day: let one go first", 429)

  const base = {
    ownerId: userId,
    kind: s.kind,
    caption: s.caption || null,
    expiresAt: expiry(),
  }
  let values: typeof schema.stories.$inferInsert
  if (s.kind === "photo" || s.kind === "video") {
    const [u] = await db
      .select()
      .from(schema.uploads)
      .where(and(eq(schema.uploads.id, s.uploadId), eq(schema.uploads.ownerId, userId)))
    const video = u?.mime.startsWith("video/")
    if (!u || (s.kind === "photo" ? video || !u.mime.startsWith("image/") : !video))
      return fail(s.kind === "photo" ? "Unknown photo" : "Unknown video", 404)
    values = {
      ...base,
      uploadId: u.id,
      song: s.kind === "photo" ? (s.song ?? null) : null,
      status: s.kind === "video" ? "processing" : "ready",
    }
  } else if (s.kind === "song") values = { ...base, song: s.song, thing: s.thing ?? null }
  else if (s.kind === "pick") values = { ...base, thing: s.thing }
  else if (s.kind === "plan") {
    const [plan] = await db
      .select({ token: schema.plans.token })
      .from(schema.plans)
      .where(
        and(
          eq(schema.plans.token, s.planToken),
          eq(schema.plans.ownerId, userId),
          isNull(schema.plans.closedAt),
        ),
      )
    if (!plan?.token) return fail("Unknown plan", 404)
    values = { ...base, planToken: plan.token }
  } else {
    const [share] = await db
      .select({ token: schema.shares.token })
      .from(schema.shares)
      .where(
        and(
          eq(schema.shares.token, s.wrappedToken),
          eq(schema.shares.ownerId, userId),
          eq(schema.shares.kind, "wrapped"),
          isNull(schema.shares.revokedAt),
        ),
      )
    if (!share) return fail("Unknown Wrapped", 404)
    values = { ...base, wrapped: { token: share.token, slide: s.slide } }
  }
  const [story] = await db.insert(schema.stories).values(values).returning()
  if (!story) return fail("Couldn't post the story", 500)
  if (story.status === "processing") await enqueue("storyVideo", { storyId: story.id })
  return json({ id: story.id, status: story.status }, 201)
}
