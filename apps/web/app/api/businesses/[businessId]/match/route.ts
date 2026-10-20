import { db, schema } from "@najimi/db"
import { emit, setRunStatus } from "@najimi/live"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withBusiness } from "@/lib/api"

/**
 * The owner says which Qloo entry is them (or none). Their word wins over the matcher's guess:
 * the chosen entry becomes the business's own entity; "none" means the report goes through the
 * comparables, said plainly on the report (R12).
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/businesses/[businessId]/match">,
) {
  const access = await withBusiness((await ctx.params).businessId)
  if ("error" in access) return access.error
  const input = await body(
    request,
    z.union([z.object({ entityId: z.string().min(1) }), z.object({ none: z.literal(true) })]),
  )
  if ("error" in input) return input.error
  const businessId = access.business.id
  await db
    .transaction(async (tx) => {
      await tx
        .update(schema.qlooMatches)
        .set({ role: "candidate" })
        .where(
          and(eq(schema.qlooMatches.businessId, businessId), eq(schema.qlooMatches.role, "own")),
        )
      if ("entityId" in input.data) {
        const [chosen] = await tx
          .update(schema.qlooMatches)
          .set({ role: "own", evidence: ["owner"] })
          .where(
            and(
              eq(schema.qlooMatches.businessId, businessId),
              eq(schema.qlooMatches.entityId, input.data.entityId),
              eq(schema.qlooMatches.role, "candidate"),
            ),
          )
          .returning({ id: schema.qlooMatches.id })
        if (!chosen) throw new Error("not a candidate")
      }
      await tx
        .update(schema.businesses)
        .set({ status: "ready" })
        .where(eq(schema.businesses.id, businessId))
    })
    .catch(() => null)
  const [business] = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
  if (business?.status !== "ready") return fail("That isn't one of the matches", 400)
  // The setup run was waiting on this answer: it ends here, with the answer as its last step.
  if (business.setupRunId) {
    await emit(business.setupRunId, "step", {
      key: "qloo",
      label:
        "entityId" in input.data
          ? "You confirmed your Qloo match"
          : "Not in Qloo — we'll go through places like you",
    })
    await setRunStatus(business.setupRunId, "done")
  }
  return json({ ok: true })
}
