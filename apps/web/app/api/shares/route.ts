import { randomBytes } from "node:crypto"
import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { and, eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

const input = z.object({ kind: z.literal("creation"), refId: z.uuid() })

/**
 * A public link to something Najimi made (C15). One live link per creation; a restyle's link shows
 * the result only, never the person's own photo.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const userId = auth.session.user.id
  const [creation] = await db
    .select({ id: schema.creations.id, status: schema.creations.status })
    .from(schema.creations)
    .where(and(eq(schema.creations.id, parsed.data.refId), eq(schema.creations.ownerId, userId)))
  if (creation?.status !== "ready") return fail("Nothing to share yet", 404)
  const [existing] = await db
    .select({ token: schema.shares.token })
    .from(schema.shares)
    .where(
      and(
        eq(schema.shares.refId, creation.id),
        eq(schema.shares.ownerId, userId),
        isNull(schema.shares.revokedAt),
      ),
    )
  const token = existing?.token ?? randomBytes(12).toString("base64url")
  if (!existing)
    await db
      .insert(schema.shares)
      .values({ ownerId: userId, token, kind: "creation", refId: creation.id })
  return json({ token, url: new URL(`/s/${token}`, env.BETTER_AUTH_URL).toString() })
}
