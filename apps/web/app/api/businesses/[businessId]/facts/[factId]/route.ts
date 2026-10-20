import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withBusiness } from "@/lib/api"
import { factInput } from "../route"

type Ctx = RouteContext<"/api/businesses/[businessId]/facts/[factId]">

const factWhere = (businessId: string, factId: string) =>
  and(eq(schema.businessFacts.id, factId), eq(schema.businessFacts.businessId, businessId))

/** The owner corrects a fact; it becomes theirs (a re-read of the site won't overwrite it). */
export async function PATCH(request: Request, ctx: Ctx) {
  const { businessId, factId } = await ctx.params
  const access = await withBusiness(businessId)
  if ("error" in access) return access.error
  const id = z.uuid().safeParse(factId).data
  if (!id) return fail("Unknown fact", 404)
  const input = await body(request, factInput)
  if ("error" in input) return input.error
  const [fact] = await db
    .update(schema.businessFacts)
    .set({ ...input.data, origin: "owner" })
    .where(factWhere(access.business.id, id))
    .returning()
  return fact ? json({ fact }) : fail("Unknown fact", 404)
}

export async function DELETE(_: Request, ctx: Ctx) {
  const { businessId, factId } = await ctx.params
  const access = await withBusiness(businessId)
  if ("error" in access) return access.error
  const id = z.uuid().safeParse(factId).data
  if (!id) return fail("Unknown fact", 404)
  await db.delete(schema.businessFacts).where(factWhere(access.business.id, id))
  return json({ ok: true })
}
