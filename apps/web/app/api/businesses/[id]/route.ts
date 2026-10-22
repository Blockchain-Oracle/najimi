import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { businessOf, viewOfBusiness } from "@/lib/business"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await businessOf((await params).id, auth.session.user.id)
  if (!b) return fail("No such business", 404)
  return json({ business: viewOfBusiness(b) })
}

/** Removes the business and its plan (a shared link stops working). */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await businessOf((await params).id, auth.session.user.id)
  if (!b) return fail("No such business", 404)
  await db.delete(schema.businesses).where(eq(schema.businesses.id, b.id))
  return json({ ok: true })
}
