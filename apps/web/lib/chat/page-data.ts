import "server-only"
import { db, schema } from "@najimi/db"
import { eq } from "drizzle-orm"
import { getTranslations } from "next-intl/server"
import { identityOf, peopleOf } from "@/lib/people"
import { startersFor } from "./starters"

/** What every chat page needs: who the user makes things for, and starters for an empty chat. */
export async function chatPageData(userId: string, personId: string | null) {
  const t = await getTranslations("Starters")
  const people = await peopleOf(userId)
  const self = people.find((p) => p.isSelf) ?? null
  const person = people.find((p) => p.id === personId) ?? self
  const loves = person
    ? await db
        .select({ type: schema.loves.type })
        .from(schema.loves)
        .where(eq(schema.loves.personId, person.id))
    : []
  const [prefs] = await db
    .select()
    .from(schema.userPrefs)
    .where(eq(schema.userPrefs.userId, userId))
  const starters = startersFor({
    loveTypes: loves.map((l) => l.type),
    city: person?.city ?? null,
    others: people.filter((p) => !p.isSelf).map((p) => p.name),
  }).map((s) => t(s.key as "whoAmI", s.args ?? {}))
  return {
    self,
    person,
    mode: prefs?.mode ?? "ask",
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      identity: identityOf(p.id),
      isSelf: p.isSelf,
    })),
    starters,
  }
}
