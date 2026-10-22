import "server-only"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { getSession } from "@/lib/session"

/**
 * A plan by its link (`/plan/<token>`): anyone with the link may see it, until its owner stops
 * sharing; then only they and the people in the chat it was made in.
 */
export async function planByToken(token: string) {
  if (!/^[a-z0-9]{8,32}$/.test(token)) return null
  const [plan] = await db.select().from(schema.plans).where(eq(schema.plans.token, token))
  if (!plan) return null
  if (!plan.closedAt) return plan
  const viewer = (await getSession())?.user.id
  if (!viewer) return null
  if (viewer === plan.ownerId) return plan
  if (!plan.chatId) return null
  const [member] = await db
    .select({ userId: schema.chatMembers.userId })
    .from(schema.chatMembers)
    .where(and(eq(schema.chatMembers.chatId, plan.chatId), eq(schema.chatMembers.userId, viewer)))
  return member ? plan : null
}
