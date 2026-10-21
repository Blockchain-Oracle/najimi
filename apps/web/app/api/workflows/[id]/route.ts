import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"

const patch = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(240),
    instructions: z.string().trim().min(10).max(2000),
    public: z.boolean(),
  })
  .partial()

const own = (id: string, userId: string) =>
  and(eq(schema.workflows.id, id), eq(schema.workflows.ownerId, userId))

/** Rename, rewrite, or open up one's own workflow (anyone with its link can then run it). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/workflows/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return fail("Not found", 404)
  const parsed = await body(request, patch)
  if ("error" in parsed) return parsed.error
  const [row] = await db
    .update(schema.workflows)
    .set(parsed.data)
    .where(own(id, auth.session.user.id))
    .returning({ id: schema.workflows.id })
  return row ? json({ ok: true }) : fail("Not found", 404)
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/workflows/[id]">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return fail("Not found", 404)
  const [row] = await db
    .delete(schema.workflows)
    .where(own(id, auth.session.user.id))
    .returning({ id: schema.workflows.id })
  return row ? json({ ok: true }) : fail("Not found", 404)
}
