import "server-only"
import { db, schema } from "@najimi/db"
import { and, eq } from "drizzle-orm"
import { selfOf } from "@/lib/people"

export type Outcome = "loved" | "fine" | "not" | "skipped"
const OUTCOMES: readonly Outcome[] = ["loved", "fine", "not", "skipped"]

/** The "How was it?" card's choice (it comes back as the option's label) as an outcome. */
export function outcomeOf(
  options: { id: string; label: string }[] | undefined,
  choice: string | undefined,
): Outcome | null {
  const id = options?.find((o) => o.label === choice || o.id === choice)?.id
  return OUTCOMES.find((o) => o === id) ?? null
}

/**
 * What you said about a booking or a night, kept on it (the Passport counts it once it happened),
 * and as taste: a place you loved is a love signal, one that wasn't for you is hidden from now on.
 * Only the owner's answer counts.
 */
export async function saveOutcome(
  userId: string,
  target: { bookingId?: string; planId?: string },
  outcome: Outcome,
) {
  if (target.planId)
    await db
      .update(schema.plans)
      .set({ outcome, status: "done" })
      .where(and(eq(schema.plans.id, target.planId), eq(schema.plans.ownerId, userId)))
  if (!target.bookingId) return
  const [booking] = await db
    .update(schema.bookings)
    .set({ outcome })
    .where(and(eq(schema.bookings.id, target.bookingId), eq(schema.bookings.ownerId, userId)))
    .returning()
  if (!booking?.qlooId || (outcome !== "loved" && outcome !== "not")) return
  const self = await selfOf(userId)
  if (!self) return
  await db.insert(schema.signals).values({
    personId: self.id,
    qlooId: booking.qlooId,
    type: "urn:entity:place",
    kind: outcome === "loved" ? "love" : "hide",
    surface: "room",
  })
}
