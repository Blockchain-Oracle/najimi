import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"

/** Revokes a share link: it stops working at once. */
export async function DELETE(_: Request, ctx: RouteContext<"/api/shares/[token]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { token } = await ctx.params
  const rows = await db
    .update(schema.shares)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.shares.token, token), eq(schema.shares.ownerId, auth.session.user.id)))
    .returning({ id: schema.shares.id })
  return rows.length ? json({ ok: true }) : fail("Unknown link", 404)
}
