import "server-only"
import { db, schema } from "@najimi/db"
import { desc, eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { identityOf, peopleOf } from "@/lib/people"
import { startersFor } from "./starters"

/**
 * What every chat page needs: the user's own profile, and for an empty chat, starters and the
 * taste it will use (the words Qloo found and the loves they came from).
 */
export async function chatPageData(userId: string, _personId: string | null) {
  const t = await getTranslations("Starters")
  const people = (await peopleOf(userId)).filter((p) => p.isSelf)
  const self = people[0] ?? null
  const person = self
  const [loves, [taste], [prefs]] = await Promise.all([
    person
      ? db
          .select({
            type: schema.loves.type,
            name: schema.loves.name,
            imageUrl: schema.loves.imageUrl,
          })
          .from(schema.loves)
          .where(eq(schema.loves.personId, person.id))
          .orderBy(desc(schema.loves.weight), desc(schema.loves.createdAt))
      : [],
    person
      ? db
          .select({ words: schema.tastes.words })
          .from(schema.tastes)
          .where(eq(schema.tastes.personId, person.id))
      : [],
    db.select().from(schema.userPrefs).where(eq(schema.userPrefs.userId, userId)),
  ])
  const starters = startersFor({
    loveTypes: loves.map((l) => l.type),
    city: person?.city ?? null,
  }).map((s) => ({ key: s.key, text: t(s.key as "whoAmI", s.args ?? {}) }))
  return {
    self,
    person,
    mode: prefs?.mode ?? "ask",
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      identity: identityOf(p.id, p.look),
      look: p.look,
      isSelf: p.isSelf,
    })),
    starters,
    taste: {
      words: taste?.words ?? null,
      loves: loves.slice(0, 5).map((l) => ({ name: l.name, imageUrl: l.imageUrl })),
    },
  }
}
