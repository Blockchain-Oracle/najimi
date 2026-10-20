import { randomBytes } from "node:crypto"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withBusiness } from "@/lib/api"

const TOKEN_BYTES = 18

/** A read-only link to one report, for the owner to share (Your People: export / share link). */
export async function POST(_: Request, ctx: RouteContext<"/api/reports/[reportId]/share">) {
  const reportId = z.uuid().safeParse((await ctx.params).reportId).data
  if (!reportId) return fail("Unknown report", 404)
  const [report] = await db
    .select()
    .from(schema.peopleReports)
    .where(eq(schema.peopleReports.id, reportId))
  if (!report) return fail("Unknown report", 404)
  const access = await withBusiness(report.businessId)
  if ("error" in access) return access.error
  const token = report.shareToken ?? randomBytes(TOKEN_BYTES).toString("base64url")
  if (!report.shareToken)
    await db
      .update(schema.peopleReports)
      .set({ shareToken: token })
      .where(eq(schema.peopleReports.id, reportId))
  return json({ token })
}
