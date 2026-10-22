import "server-only"
import { FEED, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { StoredPick } from "@najimi/db/schema"
import { type Love, profilePicks } from "@najimi/qloo"
import { mediaFor } from "@najimi/sources"
import { and, asc, eq, gt } from "drizzle-orm"
import { after } from "next/server"
import {
  FEED_DOMAINS,
  type FeedCard,
  type FeedDomain,
  type FeedMix,
  type FeedPage,
  mixKey,
  mixOf,
  sharesOf,
  slotsFor,
} from "@/lib/feed-shared"
import type { PersonRow } from "@/lib/people"

/*
 * The feed (W4): a person's taste played back a card at a time. Each page asks the mix which
 * category fills each card, takes the next picks from that category's queue (the stored picks
 * first, then Qloo's next pages for the same weighted signal), skips what they love, hid or saw
 * in the last few days, and attaches what each card plays. Where they got to is kept, so opening
 * the feed again carries on with something new; a new taste or mix starts it over.
 */

type Cursor = {
  page: number
  off: Partial<Record<FeedDomain, number>>
  dry: FeedDomain[]
  /** Second time round: everything new has been seen, so cards seen lately may come back. */
  again?: boolean
}

const START: Cursor = { page: 0, off: {}, dry: [] }

const encode = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url")

function decode(raw: string | null | undefined): Cursor | null {
  if (!raw) return null
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Cursor
    const known = new Set<string>(FEED_DOMAINS)
    if (!Number.isInteger(c.page) || c.page < 0 || c.page > 500) return null
    return {
      page: c.page,
      off: Object.fromEntries(
        Object.entries(c.off ?? {}).filter(
          ([d, n]) => known.has(d) && Number.isInteger(n) && (n as number) >= 0,
        ),
      ),
      dry: (c.dry ?? []).filter((d) => known.has(d)),
      again: c.again === true,
    }
  } catch {
    return null
  }
}

const DOMAIN_LABEL = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.key, d.label]))

type Context = {
  person: PersonRow
  loves: Love[]
  stored: Record<string, StoredPick[]>
  /** Never shown: what they love and what they hid. */
  never: Set<string>
  /** Seen in the last few days: skipped until there's nothing new left. */
  seen: Set<string>
  mix: FeedMix
}

/** One page of cards from a cursor, with the cursor after it (null when every queue is done). */
async function build(
  ctx: Context,
  cursor: Cursor,
): Promise<{ cards: StoredPick[]; next: Cursor | null; domains: FeedDomain[] }> {
  const dry = new Set<FeedDomain>(cursor.dry)
  if (!ctx.person.city) dry.add("place")
  const shares = sharesOf(ctx.mix)
  const live = Object.fromEntries(
    FEED_DOMAINS.map((d) => [d, dry.has(d) ? 0 : shares[d]]),
  ) as FeedMix
  const slots = slotsFor(live, cursor.page, FEED.pageSize)
  if (!slots.length) return { cards: [], next: null, domains: [] }

  const take = TASTE.picksPerDomain
  const skip = (id: string) => ctx.never.has(id) || (!cursor.again && ctx.seen.has(id))
  const pages = new Map<string, Promise<StoredPick[] | null>>()
  const qlooPage = (domain: FeedDomain, page: number) => {
    const key = `${domain}:${page}`
    let found = pages.get(key)
    if (!found) {
      found = profilePicks(
        ctx.loves,
        domain,
        { city: ctx.person.city, exclude: ctx.person.excludedIds, take, page },
        {
          userId: ctx.person.ownerId,
          purpose: `Your feed: more ${DOMAIN_LABEL[domain] ?? domain}`,
        },
      )
        .then((r) => r.picks)
        // A failed call isn't the end of a category: this page stops there, the next one retries.
        .catch(() => null)
      pages.set(key, found)
    }
    return found
  }
  /** The i-th pick in a category's queue, "end" past its last, "error" when Qloo didn't answer. */
  const at = async (domain: FeedDomain, i: number): Promise<StoredPick | "end" | "error"> => {
    const stored = ctx.stored[domain] ?? []
    const mine = stored[i]
    if (mine) return mine
    if (i < stored.length) return "end"
    const j = i - stored.length
    const page = 2 + Math.floor(j / take)
    if (page > FEED.maxPages) return "end"
    const list = await qlooPage(domain, page)
    if (!list) return "error"
    return list[j % take] ?? "end"
  }

  const used = new Set<string>()
  const want = new Map<FeedDomain, number>()
  for (const d of slots) want.set(d, (want.get(d) ?? 0) + 1)
  const off = { ...cursor.off }
  const got = new Map<FeedDomain, StoredPick[]>()
  // Each category walks its own queue; categories run side by side.
  await Promise.all(
    [...want].map(async ([domain, n]) => {
      const list: StoredPick[] = []
      let i = off[domain] ?? 0
      while (list.length < n) {
        const pick = await at(domain, i)
        if (pick === "end") {
          dry.add(domain)
          break
        }
        if (pick === "error") break
        i++
        if (skip(pick.qlooId) || used.has(pick.qlooId)) continue
        used.add(pick.qlooId)
        list.push(pick)
      }
      off[domain] = i
      got.set(domain, list)
    }),
  )
  const cards: StoredPick[] = []
  const domains: FeedDomain[] = []
  for (const d of slots) {
    const pick = got.get(d)?.shift()
    if (pick) {
      cards.push(pick)
      domains.push(d)
    }
  }
  const anyLeft = FEED_DOMAINS.some((d) => ctx.mix[d] > 0 && !dry.has(d))
  return {
    cards,
    domains,
    next: anyLeft
      ? { page: cursor.page + 1, off, dry: [...dry], ...(cursor.again ? { again: true } : {}) }
      : null,
  }
}

const toCard = (
  pick: StoredPick,
  domain: FeedDomain,
  media: FeedCard["media"],
  saved: boolean,
): FeedCard => ({
  id: pick.qlooId,
  type: pick.type,
  domain,
  name: pick.name,
  image: pick.image ?? (media?.kind === "cover" ? media.image : null),
  caption: pick.caption,
  affinity: pick.affinity,
  because: pick.because,
  shares: pick.shares ?? [],
  callId: pick.callId,
  links: pick.links ?? {},
  area: pick.area ?? null,
  details: pick.details ?? [],
  spotify: pick.ids?.spotify ?? null,
  media,
  saved,
})

/** The person's next page of the feed (from `cursor`, or where they got to last time). */
export async function feedPage(person: PersonRow, cursorParam?: string | null): Promise<FeedPage> {
  const [loveRows, [taste], savedRows, seenRows] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, person.id))
      .orderBy(asc(schema.loves.createdAt)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
    db
      .select({ qlooId: schema.savedPicks.qlooId })
      .from(schema.savedPicks)
      .where(eq(schema.savedPicks.personId, person.id)),
    db
      .selectDistinct({ qlooId: schema.signals.qlooId })
      .from(schema.signals)
      .where(
        and(
          eq(schema.signals.personId, person.id),
          eq(schema.signals.kind, "seen"),
          gt(schema.signals.createdAt, new Date(Date.now() - FEED.seenDays * 86_400_000)),
        ),
      ),
  ])
  const mix = mixOf(person.feedMix)
  const meta: FeedPage["meta"] = {
    personId: person.id,
    mix,
    city: person.city,
    loves: loveRows.map((r) => ({
      id: r.id,
      qlooId: r.qlooId,
      name: r.name,
      weight: r.weight,
      image: r.imageUrl,
    })),
  }
  if (!loveRows.length) return { state: "empty", cards: [], next: null, meta }
  if (!taste?.picks) return { state: "building", cards: [], next: null, runId: taste?.runId, meta }

  const key = `${taste.lovesKey ?? ""}|${mixKey(mix)}`
  const asked = decode(cursorParam)
  const resumed =
    !cursorParam && person.feedCursor?.key === key ? decode(person.feedCursor.cursor) : null
  const cursor = asked ?? resumed ?? START
  const ctx: Context = {
    person,
    loves: loveRows.map((r) => ({
      qlooId: r.qlooId,
      name: r.name,
      weight: r.weight,
      sparseDomains: r.sparseDomains,
    })),
    stored: taste.picks,
    never: new Set([...loveRows.map((r) => r.qlooId), ...person.excludedIds]),
    seen: new Set(seenRows.map((r) => r.qlooId)),
    mix,
  }

  let used = cursor
  let page = await build(ctx, cursor)
  // Nothing new left anywhere: go round again from the start, letting cards seen lately back in.
  // (Only once: a second pass that finds nothing is the end of the feed.)
  if (!page.cards.length && !cursor.again) {
    used = { ...START, again: true }
    page = await build(ctx, used)
  }
  const media = await mediaFor(page.cards).catch(() => ({}) as Awaited<ReturnType<typeof mediaFor>>)
  const saved = new Set(savedRows.map((r) => r.qlooId))
  const cards = page.cards.map((pick, i) =>
    toCard(pick, page.domains[i] as FeedDomain, media[pick.qlooId] ?? null, saved.has(pick.qlooId)),
  )

  // Remember this page (a reload shows it again rather than skipping it), and look up the next
  // page's media once the answer has gone, so the swipe after it plays at once.
  await db
    .update(schema.people)
    .set({ feedCursor: { key, cursor: encode(page.next ? used : START) } })
    .where(eq(schema.people.id, person.id))
  const next = page.next
  if (next)
    after(async () => {
      const ahead = await build(ctx, next).catch(() => null)
      if (ahead?.cards.length) await mediaFor(ahead.cards).catch(() => null)
    })
  return { state: "ready", cards, next: next ? encode(next) : null, meta }
}
