import { db, schema } from "@najimi/db"
import { and, asc, desc, eq } from "drizzle-orm"
import sharp from "sharp"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { scoreFeed } from "@/lib/feed-score"
import { selfOf } from "@/lib/people"
import { allow } from "@/lib/rate-limit"

const platform = z.enum(["x", "instagram", "tiktok", "youtube"])
const MAX_BYTES = 8 * 1024 * 1024

/** Your feed scores over time, newest first. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const rows = await db
    .select()
    .from(schema.feedScores)
    .where(eq(schema.feedScores.userId, auth.session.user.id))
    .orderBy(desc(schema.feedScores.createdAt))
    .limit(40)
  return json({ scores: rows })
}

/** A screenshot of a feed in, its score out (the picture is read and dropped, never kept). */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`feedscore:${me}`, 6, 60 * 60_000)) return fail("That's plenty for this hour", 429)
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  const which = platform.safeParse(form?.get("platform"))
  if (!(file instanceof File) || !which.success) return fail("Add a screenshot of your feed", 400)
  if (file.size > MAX_BYTES) return fail("That screenshot is over 8 MB", 413)
  let jpeg: Buffer
  try {
    jpeg = await sharp(Buffer.from(await file.arrayBuffer()), { failOn: "error" })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
  } catch {
    return fail("That file isn't a screenshot we can read", 415)
  }
  const self = await selfOf(me)
  if (!self) return fail("Pick a few loves first", 409)
  const loves = (
    await db
      .select()
      .from(schema.loves)
      .where(and(eq(schema.loves.personId, self.id)))
      .orderBy(asc(schema.loves.createdAt))
  ).map((l) => ({ qlooId: l.qlooId, name: l.name, weight: l.weight }))
  try {
    return json(
      await scoreFeed({ userId: me, platform: which.data, image: new Uint8Array(jpeg), loves }),
    )
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't read that screenshot", 422)
  }
}
