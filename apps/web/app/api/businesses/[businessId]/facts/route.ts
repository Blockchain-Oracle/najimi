import { db, schema } from "@najimi/db"
import { eq, max } from "drizzle-orm"
import { z } from "zod"
import { body, json, withBusiness } from "@/lib/api"

export const factInput = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(2000),
})

/** The owner adds a fact to the sheet (F10: the only source of product facts agents may use). */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/businesses/[businessId]/facts">,
) {
  const access = await withBusiness((await ctx.params).businessId)
  if ("error" in access) return access.error
  const input = await body(request, factInput)
  if ("error" in input) return input.error
  const [last] = await db
    .select({ position: max(schema.businessFacts.position) })
    .from(schema.businessFacts)
    .where(eq(schema.businessFacts.businessId, access.business.id))
  const [fact] = await db
    .insert(schema.businessFacts)
    .values({
      businessId: access.business.id,
      ...input.data,
      origin: "owner",
      position: (last?.position ?? -1) + 1,
    })
    .returning()
  return json({ fact }, 201)
}
