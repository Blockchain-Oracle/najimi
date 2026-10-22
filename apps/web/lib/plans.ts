import "server-only"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"

/** A plan by its link (`/plan/<token>`): anyone with the link may see it. */
export async function planByToken(token: string) {
  if (!/^[a-z0-9]{8,32}$/.test(token)) return null
  const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.token, token))
  return plan ?? null
}
