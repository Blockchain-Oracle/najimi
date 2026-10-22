import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { GameItem, GameKind, StoredPick } from "@najimi/db/schema"
import { type CallContext, type Love, profileInsights } from "@najimi/qloo"
import { and, asc, eq, ne } from "drizzle-orm"

/*
 * Building a round from real taste: never invented. The wavelength and Blind Taste ask Qloo how
 * the subject's taste scores each item (a shortlist scored against their loves); How well do you
 * know me uses their actual loves against decoys from other people's; Taste twins uses loves that
 * only one person in the circle has.
 */

const ROUND = 5
const TYPE = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.type, d.key]))

const shuffle = <T>(list: T[]): T[] => {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % (i + 1)
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

async function selfOf(userId: string) {
  const [person] = await db
    .select()
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  if (!person) return null
  const [loves, [taste]] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, person.id))
      .orderBy(asc(schema.loves.createdAt)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
  ])
  return { person, loves, picks: (taste?.picks ?? {}) as Record<string, StoredPick[]> }
}

const toLoves = (rows: { qlooId: string; name: string; weight: number }[]): Love[] =>
  rows.map((r) => ({ qlooId: r.qlooId, name: r.name, weight: r.weight }))

/** Picks from other people's tastes (things this person might not know), with artwork. */
async function othersPicks(
  userId: string,
  exclude: Set<string>,
  limit = 40,
): Promise<StoredPick[]> {
  const rows = await db
    .select({ picks: schema.tastes.picks })
    .from(schema.tastes)
    .innerJoin(schema.people, eq(schema.people.id, schema.tastes.personId))
    .where(and(ne(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
    .limit(60)
  const all = rows.flatMap((r) => Object.values(r.picks ?? {}).flat())
  const seen = new Set<string>()
  return shuffle(all)
    .filter(
      (p) =>
        p.image &&
        TYPE[p.type] &&
        !exclude.has(p.qlooId) &&
        !seen.has(p.qlooId) &&
        seen.add(p.qlooId),
    )
    .slice(0, limit)
}

/** Qloo's 0–100 for each item against a taste (one scored shortlist per kind of thing). */
async function scoreAgainst(loves: Love[], items: StoredPick[], ctx: CallContext) {
  const byType = new Map<string, StoredPick[]>()
  for (const p of items) byType.set(p.type, [...(byType.get(p.type) ?? []), p])
  const scores = new Map<string, number>()
  await Promise.all(
    [...byType].map(async ([type, list]) => {
      const r = await profileInsights(
        loves,
        { filterType: type, only: list.map((p) => p.qlooId), take: list.length },
        ctx,
      ).catch(() => null)
      for (const it of r?.items ?? [])
        if (it.affinity != null) scores.set(it.entityId, Math.round(it.affinity * 100))
    }),
  )
  return scores
}

/**
 * Qloo scores most plausible things highly (80–95 for a taste's own neighbourhood), so a round's
 * numbers are spread across the pool it was drawn from: the least-loved item lands near 5, the
 * most-loved near 98, the rest in proportion. "How much would they love it?" then means something.
 * Five are kept from across that spread.
 */
function spread(pool: StoredPick[], scores: Map<string, number>): GameItem[] {
  const scored = pool.flatMap((p) => {
    const s = scores.get(p.qlooId)
    return s === undefined ? [] : [{ p, s }]
  })
  if (scored.length < 3) return []
  const lo = Math.min(...scored.map((x) => x.s))
  const hi = Math.max(...scored.map((x) => x.s))
  const items = scored
    .map(({ p, s }) => asItem(p, hi === lo ? s : Math.round(5 + ((s - lo) / (hi - lo)) * 93)))
    .sort((a, b) => a.truth - b.truth)
  if (items.length <= ROUND) return shuffle(items)
  const step = (items.length - 1) / (ROUND - 1)
  return shuffle(Array.from({ length: ROUND }, (_, i) => items[Math.round(i * step)] as GameItem))
}

const asItem = (p: StoredPick, truth: number): GameItem => ({
  qlooId: p.qlooId,
  type: p.type,
  name: p.name,
  image: p.image,
  caption: p.caption,
  truth,
})

/**
 * Guess my wavelength: five things, some from the subject's own taste and some from other
 * people's; you guess how much the subject would love each (0–100), Qloo knows.
 */
export async function buildWavelength(subjectId: string, ctx: CallContext): Promise<GameItem[]> {
  const subject = await selfOf(subjectId)
  if (!subject?.loves.length) throw new Error("They need a few loves first")
  const own = shuffle(
    Object.values(subject.picks)
      .flat()
      .filter((p) => p.image && TYPE[p.type]),
  ).slice(0, 4)
  const known = new Set([...subject.loves.map((l) => l.qlooId), ...own.map((p) => p.qlooId)])
  const others = (await othersPicks(subjectId, known)).slice(0, 8)
  const pool = [...own.slice(0, 2), ...others]
  const items = spread(pool, await scoreAgainst(toLoves(subject.loves), pool, ctx))
  if (items.length < 3) throw new Error("Qloo couldn't score enough things for this taste")
  return items
}

/** Blind Taste: five things you may not know; Qloo predicts how you'll feel, you say. */
export async function buildBlind(playerId: string, ctx: CallContext): Promise<GameItem[]> {
  const player = await selfOf(playerId)
  if (!player?.loves.length) throw new Error("Pick a few loves first")
  const known = new Set([
    ...player.loves.map((l) => l.qlooId),
    ...Object.values(player.picks)
      .flat()
      .map((p) => p.qlooId),
  ])
  const pool = (await othersPicks(playerId, known)).slice(0, 10)
  const items = spread(pool, await scoreAgainst(toLoves(player.loves), pool, ctx))
  if (items.length < 3) throw new Error("Qloo couldn't score enough things for your taste")
  return items
}

/** How well do you know me: which of these four did they pick as a love? */
export async function buildKnowMe(subjectId: string): Promise<GameItem[]> {
  const subject = await selfOf(subjectId)
  if (!subject || subject.loves.length < 2) throw new Error("They need a few loves first")
  const mine = new Set(subject.loves.map((l) => l.qlooId))
  const decoys = await othersPicks(subjectId, mine, 120)
  return shuffle(subject.loves)
    .slice(0, ROUND)
    .flatMap((love) => {
      const sameKind = decoys.filter((d) => d.type === love.type).slice(0, 3)
      const others = sameKind.length >= 2 ? sameKind : decoys.slice(0, 3)
      for (const used of others) decoys.splice(decoys.indexOf(used), 1)
      if (others.length < 2) return []
      const options = shuffle([
        { id: love.qlooId, label: love.name, image: love.imageUrl },
        ...others.map((o) => ({ id: o.qlooId, label: o.name, image: o.image })),
      ])
      return [
        {
          qlooId: love.qlooId,
          type: love.type,
          name: love.name,
          image: null,
          caption: null,
          truth: options.findIndex((o) => o.id === love.qlooId),
          options,
        },
      ]
    })
}

/** Taste twins: who in the circle loves this? (Only loves one member has.) */
export async function buildTwins(chatId: string): Promise<GameItem[]> {
  const members = await db
    .select({
      userId: schema.chatMembers.userId,
      personId: schema.people.id,
      name: schema.people.name,
      look: schema.people.look,
    })
    .from(schema.chatMembers)
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.chatMembers.chatId, chatId))
  if (members.length < 2) throw new Error("Taste twins needs two or more people in the circle")
  const loves = await Promise.all(
    members.map((m) => db.select().from(schema.loves).where(eq(schema.loves.personId, m.personId))),
  )
  const count = new Map<string, number>()
  for (const list of loves)
    for (const l of list) count.set(l.qlooId, (count.get(l.qlooId) ?? 0) + 1)
  const options = members.map((m) => ({ id: m.userId, label: m.name, look: m.look }))
  const candidates = shuffle(
    loves.flatMap((list, i) =>
      list.filter((l) => count.get(l.qlooId) === 1).map((l) => ({ l, i })),
    ),
  )
  // Spread the questions across members.
  const picked: typeof candidates = []
  for (const c of candidates) {
    if (picked.length >= ROUND) break
    if (picked.filter((p) => p.i === c.i).length < 2) picked.push(c)
  }
  return picked.map(({ l, i }) => ({
    qlooId: l.qlooId,
    type: l.type,
    name: l.name,
    image: l.imageUrl,
    caption: null,
    truth: i,
    options,
  }))
}

export async function buildRound(
  kind: GameKind,
  input: { subjectId?: string | null; playerId: string; chatId?: string | null },
  ctx: CallContext,
): Promise<GameItem[]> {
  if (kind === "wavelength") return buildWavelength(input.subjectId ?? input.playerId, ctx)
  if (kind === "knowme") return buildKnowMe(input.subjectId ?? input.playerId)
  if (kind === "twins") {
    if (!input.chatId) throw new Error("Taste twins is played in a circle")
    return buildTwins(input.chatId)
  }
  return buildBlind(input.playerId, ctx)
}
