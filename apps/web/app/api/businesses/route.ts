import { startBusiness } from "@najimi/agent/server"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { businessesOf, viewOfBusiness } from "@/lib/business"

const input = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().max(160).optional(),
  site: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(60).optional(),
  audience: z.string().trim().max(240).optional(),
  decision: z.string().trim().max(240).optional(),
})

/** Your businesses. */
export async function GET() {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  return json({ businesses: (await businessesOf(auth.session.user.id)).map(viewOfBusiness) })
}

/** Opens a business and starts building its plan (watch it at /business/<id>). */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  try {
    const b = await startBusiness(auth.session.user.id, parsed.data)
    return json({ id: b.id, runId: b.runId })
  } catch (e) {
    return fail((e as Error).message, 429)
  }
}
