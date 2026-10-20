import { claudeConfigured } from "@najimi/claude"
import { db, schema } from "@najimi/db"
import { qlooConfigured } from "@najimi/qloo"
import { asc, eq } from "drizzle-orm"
import { json, withBusiness } from "@/lib/api"

/** A business with its fact sheet and its place in Qloo (the setup page and dashboard read this). */
export async function GET(_: Request, ctx: RouteContext<"/api/businesses/[businessId]">) {
  const access = await withBusiness((await ctx.params).businessId)
  if ("error" in access) return access.error
  const { business } = access
  const [facts, matches] = await Promise.all([
    db
      .select()
      .from(schema.businessFacts)
      .where(eq(schema.businessFacts.businessId, business.id))
      .orderBy(asc(schema.businessFacts.position), asc(schema.businessFacts.createdAt)),
    db.select().from(schema.qlooMatches).where(eq(schema.qlooMatches.businessId, business.id)),
  ])
  return json({
    business,
    facts,
    matches,
    services: { qloo: qlooConfigured(), claude: claudeConfigured() },
  })
}
