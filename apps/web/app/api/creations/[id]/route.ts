import { db, schema } from "@najimi/db"
import { deleteKeys } from "@najimi/storage"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"

/** Deletes a creation: its row, every stored copy, and any share link to it. */
export async function DELETE(_: Request, ctx: RouteContext<"/api/creations/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const id = z.uuid().safeParse((await ctx.params).id).data
  if (!id) return fail("Unknown creation", 404)
  const [row] = await db
    .delete(schema.creations)
    .where(and(eq(schema.creations.id, id), eq(schema.creations.ownerId, auth.session.user.id)))
    .returning()
  if (!row) return fail("Unknown creation", 404)
  await db.delete(schema.shares).where(eq(schema.shares.refId, id))
  // A video's poster is its source image's display copy: never delete what another creation owns.
  const keys = row.kind === "video" ? [row.s3Key] : [row.s3Key, row.displayKey, row.thumbKey]
  await deleteKeys(keys.filter((k): k is string => Boolean(k))).catch(() => undefined)
  return json({ ok: true })
}
