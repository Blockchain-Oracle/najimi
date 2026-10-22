import { randomBytes } from "node:crypto"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { businessOf } from "@/lib/business"

type Params = { params: Promise<{ id: string }> }

/** A public link to the plan (/b/<token>), kept until it's stopped. */
export async function POST(_request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await businessOf((await params).id, auth.session.user.id)
  if (!b) return fail("No such business", 404)
  if (b.status !== "ready") return fail("The plan isn't ready yet", 409)
  const token = b.shareToken ?? randomBytes(12).toString("base64url")
  if (!b.shareToken)
    await db
      .update(schema.businesses)
      .set({ shareToken: token })
      .where(eq(schema.businesses.id, b.id))
  return json({ token })
}

/** Stops sharing: the link stops working. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const b = await businessOf((await params).id, auth.session.user.id)
  if (!b) return fail("No such business", 404)
  await db.update(schema.businesses).set({ shareToken: null }).where(eq(schema.businesses.id, b.id))
  return json({ ok: true })
}
