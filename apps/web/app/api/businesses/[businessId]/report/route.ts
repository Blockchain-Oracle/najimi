import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { fail, json, withBusiness } from "@/lib/api"
import { latestReport, reportBasis } from "@/lib/reports"

type Ctx = RouteContext<"/api/businesses/[businessId]/report">

/** The newest Your People report (the report page reads this; sections fill in while it builds). */
export async function GET(_: Request, ctx: Ctx) {
  const access = await withBusiness((await ctx.params).businessId)
  if ("error" in access) return access.error
  return json({ report: await latestReport(access.business.id) })
}

/** Builds a fresh report ("Find my people"). The run's sections stream to the page as they land. */
export async function POST(_: Request, ctx: Ctx) {
  const access = await withBusiness((await ctx.params).businessId)
  if ("error" in access) return access.error
  const { business, session } = access
  if (business.status !== "ready") return fail("Finish reading the site first", 409)
  const basis = await reportBasis(business)
  const created = await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(schema.runs)
      .values({ ownerId: session.user.id, businessId: business.id, kind: "people-report" })
      .returning({ id: schema.runs.id })
    if (!run) throw new Error("insert failed")
    const [report] = await tx
      .insert(schema.peopleReports)
      .values({ businessId: business.id, runId: run.id, basis })
      .returning({ id: schema.peopleReports.id })
    if (!report) throw new Error("insert failed")
    return { runId: run.id, reportId: report.id }
  })
  await enqueue("peopleReport", { businessId: business.id, ...created })
  return json(created, 201)
}
