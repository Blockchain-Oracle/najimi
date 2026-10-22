import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { asc, eq } from "drizzle-orm"
import { fail, json, withSession } from "@/lib/api"
import { lensesFor } from "@/lib/earth"
import { selfOf } from "@/lib/people"
import { profileByUsername } from "@/lib/social"

/**
 * A taste as a graph (W13): the person, their loves (weight, artwork, when each arrived), and
 * Qloo's picks with each love's explainability share, so the page can draw the edges and re-rank
 * instantly when a weight moves. Yours, or someone whose profile you can see.
 */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const who = new URL(request.url).searchParams.get("who") ?? "me"
  let person: typeof schema.people.$inferSelect | null = null
  let loves: (typeof schema.loves.$inferSelect)[] = []
  let picks: Record<string, StoredPick[]> = {}
  if (who === "me") {
    person = await selfOf(me)
    if (person) {
      const [rows, [taste]] = await Promise.all([
        db
          .select()
          .from(schema.loves)
          .where(eq(schema.loves.personId, person.id))
          .orderBy(asc(schema.loves.createdAt)),
        db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
      ])
      loves = rows
      picks = (taste?.picks ?? {}) as Record<string, StoredPick[]>
    }
  } else if (who.startsWith("u:")) {
    const profile = await profileByUsername(who.slice(2), me)
    if (profile && !profile.hidden) {
      person = profile.row.person
      loves = profile.loves
      picks = (profile.taste?.picks ?? {}) as Record<string, StoredPick[]>
    }
  }
  if (!person) return fail("Nothing to show", 404)
  return json({
    person: { id: person.id, name: person.name, look: person.look, mine: person.ownerId === me },
    // People whose taste can be laid over this one.
    lenses: who === "me" ? await lensesFor(me) : { people: [], circles: [] },
    loves: loves.map((l) => ({
      id: l.id,
      qlooId: l.qlooId,
      name: l.name,
      type: l.type,
      weight: l.weight,
      image: l.imageUrl,
      at: l.createdAt,
    })),
    picks: Object.entries(picks).flatMap(([domain, list]) =>
      // People in culture live on People; the graph is things.
      domain === "person"
        ? []
        : list.slice(0, 6).map((p) => ({
            qlooId: p.qlooId,
            type: p.type,
            domain,
            name: p.name,
            image: p.image,
            caption: p.caption,
            affinity: p.affinity,
            shares:
              p.shares ??
              (p.because ? [{ id: p.because.qlooId, share: p.because.share ?? 1 }] : []),
          })),
    ),
  })
}
