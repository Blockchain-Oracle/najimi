import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json } from "@/lib/api"
import { getSession } from "@/lib/session"
import { normalizeSiteUrl } from "@/lib/site-url"

/** Paste a website: the business is created and its reading starts (F1, F5). */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return fail("Sign in first", 401)
  const input = await body(request, z.object({ url: z.string().min(3).max(500) }))
  if ("error" in input) return input.error
  const url = normalizeSiteUrl(input.data.url)
  if (!url) return fail("That doesn't look like a website", 400)
  const created = await db.transaction(async (tx) => {
    const [business] = await tx
      .insert(schema.businesses)
      .values({ ownerId: session.user.id, url, host: new URL(url).hostname.replace(/^www\./, "") })
      .returning({ id: schema.businesses.id })
    if (!business) throw new Error("insert failed")
    const [run] = await tx
      .insert(schema.runs)
      .values({ ownerId: session.user.id, businessId: business.id, kind: "business-setup" })
      .returning({ id: schema.runs.id })
    if (!run) throw new Error("insert failed")
    await tx
      .update(schema.businesses)
      .set({ setupRunId: run.id })
      .where(eq(schema.businesses.id, business.id))
    return { businessId: business.id, runId: run.id }
  })
  await enqueue("businessSetup", created)
  return json(created, 201)
}
