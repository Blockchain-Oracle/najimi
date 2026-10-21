import { db, schema } from "@najimi/db"
import { and, desc, eq, inArray, lt } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"

const PAGE = 24
const query = z.object({
  kind: z.enum(["image", "video"]).optional(),
  before: z.iso.datetime().optional(),
})

/** Assets (T16): everything made, newest first, a page at a time. */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const q = query.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!q.success) return fail("That doesn't look right", 400)
  const rows = await db
    .select({
      id: schema.creations.id,
      kind: schema.creations.kind,
      purpose: schema.creations.purpose,
      title: schema.creations.title,
      words: schema.creations.words,
      width: schema.creations.width,
      height: schema.creations.height,
      chatId: schema.creations.chatId,
      sourceCreationId: schema.creations.sourceCreationId,
      createdAt: schema.creations.createdAt,
    })
    .from(schema.creations)
    .where(
      and(
        eq(schema.creations.ownerId, auth.session.user.id),
        inArray(schema.creations.status, ["ready"]),
        q.data.kind ? eq(schema.creations.kind, q.data.kind) : undefined,
        q.data.before ? lt(schema.creations.createdAt, new Date(q.data.before)) : undefined,
      ),
    )
    .orderBy(desc(schema.creations.createdAt))
    .limit(PAGE + 1)
  return json({
    creations: rows.slice(0, PAGE),
    next: rows.length > PAGE ? rows[PAGE - 1]?.createdAt.toISOString() : null,
  })
}
