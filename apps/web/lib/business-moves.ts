import type { BusinessMove, BusinessReport } from "@najimi/db/schema"

/*
 * A plan's moves for this week. Plans built before moves had a longer list of ideas: their first
 * three read as moves, each with the next step its kind suggests (a partner idea invites the
 * partner, a music idea plays the set, anything else is planned with Najimi).
 */
export function movesOf(plan: NonNullable<BusinessReport["plan"]>, name: string): BusinessMove[] {
  if (plan.moves?.length) return plan.moves.slice(0, 3)
  return (plan.ideas ?? []).slice(0, 3).map((idea) => {
    const partner = idea.kind === "partner" ? (idea.evidence[0] ?? null) : null
    const type = partner ? "invite" : idea.kind === "music" ? "play" : "plan"
    return {
      ...idea,
      next: {
        type,
        text: type === "plan" ? `Plan this at ${name}: ${idea.title}` : "",
        partner,
      },
    }
  })
}
