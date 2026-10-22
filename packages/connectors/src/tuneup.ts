import type { TuneUpItem } from "@najimi/db/schema"
import { type CallContext, type Love, profileInsights, type TasteItem } from "@najimi/qloo"
import { type SocialAccounts, socialAccountsFor } from "@najimi/sources"

/*
 * The daily tune-up (W15): five minutes that turn someone's feeds toward their taste. Every
 * account is a real one Qloo matched to their loves, with its handle from Qloo's own record or, for
 * TikTok and YouTube (and when Qloo has none), the accounts it lists on Wikidata; every topic list
 * comes from what they love. Without a known account, it's the platform's own search. Tapping goes to the exact profile, the
 * follow intent, or the platform's own feed controls. Nothing repeats from the last fortnight.
 */

const KINDS = ["urn:entity:person", "urn:entity:artist", "urn:entity:brand"] as const
const PER_PLATFORM = 3

const id = (...parts: string[]) => parts.join(":").toLowerCase()

export async function buildTuneUp(input: {
  loves: Love[]
  /** Words from their taste (Qloo's), for topic lists. */
  words: string[]
  /** Handles and names already suggested lately. */
  seen: Set<string>
  ctx: CallContext
}): Promise<TuneUpItem[]> {
  if (!input.loves.length) return []
  const lists = await Promise.all(
    KINDS.map((filterType) =>
      profileInsights(
        input.loves,
        { filterType, take: 25 },
        { ...input.ctx, purpose: "Your feeds' tune-up" },
      )
        .then((r) => r.items)
        .catch(() => [] as TasteItem[]),
    ),
  )
  // People first, then artists, then brands; strongest first within each.
  const pool = lists.flat()
  const qidOf = (item: TasteItem) => {
    const value = item.external.wikidata
    const first = Array.isArray(value) ? value[0] : null
    return first && typeof first === "object" && "id" in first
      ? String(first.id).toUpperCase()
      : null
  }
  const accounts: Record<string, SocialAccounts> = await socialAccountsFor(
    pool.flatMap((i) => {
      const q = qidOf(i)
      return q ? [q] : []
    }),
  ).catch(() => ({}))
  const on = (item: TasteItem, platform: keyof SocialAccounts) => {
    const q = qidOf(item)
    return q ? (accounts[q]?.[platform] ?? null) : null
  }
  const because = (item: TasteItem) => {
    const top = [...item.drivers].sort((a, b) => b.score - a.score)[0]
    const love = input.loves.find((l) => l.qlooId === top?.entityId)
    return love ? `Because you love ${love.name}` : null
  }
  const items: TuneUpItem[] = []
  const take = (
    platform: TuneUpItem["platform"],
    handleOf: (i: TasteItem) => string | null,
    url: (h: string) => string,
    shown: (h: string) => string | null = (h) => h,
  ) => {
    let n = 0
    for (const item of pool) {
      if (n >= PER_PLATFORM) break
      const h = handleOf(item)
      if (!h || input.seen.has(id(platform, h)) || input.seen.has(id(platform, item.name))) continue
      if (items.some((x) => x.platform === platform && (x.target === h || x.label === item.name)))
        continue
      items.push({
        id: id(platform, "follow", h),
        platform,
        kind: "follow",
        label: item.name,
        why: because(item),
        handle: shown(h),
        target: h,
        image: item.image,
        url: url(h),
        done: false,
      })
      n++
    }
    return n
  }
  take(
    "x",
    (i) => i.handles.twitter ?? on(i, "x"),
    (h) => `https://x.com/intent/follow?screen_name=${encodeURIComponent(h)}`,
  )
  take(
    "instagram",
    (i) => i.handles.instagram ?? on(i, "instagram"),
    (h) => `https://www.instagram.com/${encodeURIComponent(h)}/`,
  )
  const tiktok = take(
    "tiktok",
    (i) => on(i, "tiktok"),
    (h) => `https://www.tiktok.com/@${encodeURIComponent(h)}`,
  )
  // A channel id opens YouTube's own "Subscribe?" confirmation.
  const youtube = take(
    "youtube",
    (i) => on(i, "youtube"),
    (h) => `https://www.youtube.com/channel/${encodeURIComponent(h)}?sub_confirmation=1`,
    () => null,
  )

  // Without a known account: their own search, for the same people.
  const listed = (platform: TuneUpItem["platform"]) =>
    new Set(items.filter((x) => x.platform === platform).map((x) => x.label))
  const tiktokListed = listed("tiktok")
  const named = pool.filter(
    (i) => !input.seen.has(id("tiktok", i.name)) && !tiktokListed.has(i.name),
  )
  for (const item of named.slice(0, PER_PLATFORM - tiktok))
    items.push({
      id: id("tiktok", "search", item.name),
      platform: "tiktok",
      kind: "search",
      label: item.name,
      why: because(item),
      handle: null,
      image: item.image,
      url: `https://www.tiktok.com/search/user?q=${encodeURIComponent(item.name)}`,
      done: false,
    })
  const youtubeListed = listed("youtube")
  for (const item of pool
    .filter((i) => !input.seen.has(id("youtube", i.name)) && !youtubeListed.has(i.name))
    .slice(0, PER_PLATFORM - youtube))
    items.push({
      id: id("youtube", "search", item.name),
      platform: "youtube",
      kind: "search",
      label: item.name,
      why: because(item),
      handle: null,
      image: item.image,
      // YouTube's own channel filter on the results.
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(item.name)}&sp=EgIQAg%253D%253D`,
      done: false,
    })

  // Each platform's own feed controls, filled with their taste.
  const topics = [
    ...input.loves
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 4)
      .map((l) => l.name),
    ...input.words.slice(0, 4),
  ]
  if (topics.length) {
    items.push({
      id: id("instagram", "topics", topics.join("|")),
      platform: "instagram",
      kind: "topics",
      label: "Your Algorithm",
      why: "Profile → ≡ → Your Algorithm → add these",
      url: null,
      words: topics,
      done: false,
    })
    items.push({
      id: id("tiktok", "topics", topics.join("|")),
      platform: "tiktok",
      kind: "topics",
      label: "Manage topics",
      why: "Settings → Content preferences → Manage topics",
      url: null,
      words: topics,
      done: false,
    })
  }
  return items
}
