import { MEDIA_LINKS } from "@najimi/config"
import { env } from "@najimi/env/server"
import { XMLParser } from "fast-xml-parser"
import { cachedMany } from "./cache"
import { fetchPublic } from "./fetch"

/*
 * What a feed card plays or shows, from the ids Qloo already gives each pick:
 *   artist  → Wikidata P2850 (Apple Music artist id) → iTunes songs with 30-second previews
 *   podcast → iTunes id → the show's own RSS feed → its latest episode (full audio)
 *   film/TV → IMDb id → TMDB → the official YouTube trailer (played visibly, on tap)
 * Each look-up is batched per feed page and kept in `external_cache`; nothing is guessed (an
 * artist with no Apple id is searched by exact name only). Apple's previews are streamed from
 * Apple, never stored: only their addresses are kept, with the store link the credit needs.
 */

export type Song = {
  title: string
  artist: string
  /** Apple's 30-second preview (AAC), streamed from Apple. */
  preview: string
  /** The track on Apple Music: the credit's link. */
  store: string
  artwork: string | null
  ms: number | null
}

export type Episode = {
  title: string
  show: string
  /** The episode's own audio file, from the show's feed. */
  audio: string
  /** The show on Apple Podcasts. */
  store: string | null
  artwork: string | null
  seconds: number | null
  published: string | null
}

export type Trailer = { youtube: string; title: string }

const json = async <T>(url: string, init?: RequestInit): Promise<T | null> => {
  const response = await fetch(url, {
    ...init,
    headers: { "user-agent": MEDIA_LINKS.userAgent, accept: "application/json", ...init?.headers },
    signal: AbortSignal.timeout(MEDIA_LINKS.timeoutMs),
  }).catch(() => null)
  if (!response?.ok) return null
  return (await response.json().catch(() => null)) as T | null
}

const chunks = <T>(all: T[], size: number) =>
  Array.from({ length: Math.ceil(all.length / size) }, (_, i) =>
    all.slice(i * size, (i + 1) * size),
  )

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")

/** Apple artwork comes as a 100px URL; the size is part of the path. */
const bigArt = (url?: string) =>
  url ? url.replace(/\/\d+x\d+bb\./, `/${MEDIA_LINKS.artwork}x${MEDIA_LINKS.artwork}bb.`) : null

// ── Artists → Apple ───────────────────────────────────────────────────────────────────────────

type WikidataClaims = {
  entities?: Record<
    string,
    { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }
  >
}

/** Apple Music artist ids for Wikidata items (P2850), 50 items a request. */
async function appleIdsFromWikidata(qids: string[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {}
  for (const batch of chunks(qids, MEDIA_LINKS.batch)) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "claims",
      format: "json",
    })
    const body = await json<WikidataClaims>(`https://www.wikidata.org/w/api.php?${params}`)
    if (!body?.entities) continue
    for (const qid of batch) {
      const value = body.entities[qid]?.claims?.P2850?.[0]?.mainsnak?.datavalue?.value
      out[qid] = typeof value === "string" && /^\d+$/.test(value) ? value : null
    }
  }
  return out
}

type ItunesResult = {
  wrapperType?: string
  kind?: string
  artistId?: number
  artistName?: string
  collectionId?: number
  collectionName?: string
  trackName?: string
  previewUrl?: string
  trackViewUrl?: string
  collectionViewUrl?: string
  artworkUrl100?: string
  artworkUrl600?: string
  trackTimeMillis?: number
  feedUrl?: string
}

const itunes = (path: "search" | "lookup", params: Record<string, string>) =>
  json<{ results?: ItunesResult[] }>(
    `https://itunes.apple.com/${path}?${new URLSearchParams({ country: MEDIA_LINKS.country, ...params })}`,
  )

/**
 * Apple artist ids by exact name, for artists Wikidata has no Apple id for. Keys are normalised
 * names; `display` gives the name to search with.
 */
const appleIdsByName =
  (display: Map<string, string>) =>
  async (names: string[]): Promise<Record<string, string | null>> => {
    const out: Record<string, string | null> = {}
    // iTunes allows about 20 calls a minute: a few searches per request, the rest next time.
    for (const name of names.slice(0, MEDIA_LINKS.nameSearches)) {
      const body = await itunes("search", {
        term: display.get(name) ?? name,
        entity: "musicArtist",
        attribute: "artistTerm",
        limit: "5",
      })
      if (!body) continue
      const hit = body.results?.find((r) => r.artistName && norm(r.artistName) === name)
      out[name] = hit?.artistId ? String(hit.artistId) : null
    }
    return out
  }

/** Each Apple artist's top songs with previews (one lookup for up to 50 artists). */
async function songsOfArtists(appleIds: string[]): Promise<Record<string, Song[] | null>> {
  const out: Record<string, Song[] | null> = {}
  for (const batch of chunks(appleIds, MEDIA_LINKS.batch)) {
    const body = await itunes("lookup", {
      id: batch.join(","),
      entity: "song",
      limit: String(MEDIA_LINKS.songsPerArtist),
    })
    if (!body?.results) continue
    for (const id of batch) out[id] = []
    // Songs follow their artist's row; a feature can carry another artist's id, so the row
    // above it decides whose song it is.
    let current: string | null = null
    for (const r of body.results) {
      if (r.wrapperType === "artist") {
        current = r.artistId ? String(r.artistId) : null
        continue
      }
      if (!current || !r.previewUrl || !r.trackViewUrl || !r.trackName) continue
      out[current]?.push({
        title: r.trackName,
        artist: r.artistName ?? "",
        preview: r.previewUrl,
        store: r.trackViewUrl,
        artwork: bigArt(r.artworkUrl100),
        ms: r.trackTimeMillis ?? null,
      })
    }
    for (const id of batch) if (!out[id]?.length) out[id] = null
  }
  return out
}

/** Songs for artist picks, keyed by the pick's Qloo id. */
export async function songsFor(
  artists: { qlooId: string; name: string; wikidata?: string }[],
): Promise<Record<string, Song[]>> {
  if (!artists.length) return {}
  const qids = artists.flatMap((a) => (a.wikidata ? [a.wikidata] : []))
  const fromWikidata = await cachedMany(
    "apple-artist-wd",
    qids,
    MEDIA_LINKS.days.appleId,
    appleIdsFromWikidata,
  )
  const unnamed = artists.filter((a) => !(a.wikidata && fromWikidata[a.wikidata]))
  const display = new Map(unnamed.map((a) => [norm(a.name), a.name]))
  const byName = await cachedMany(
    "apple-artist-name",
    [...display.keys()].filter(Boolean),
    MEDIA_LINKS.days.appleId,
    appleIdsByName(display),
  )
  const appleOf = (a: (typeof artists)[number]) =>
    (a.wikidata ? fromWikidata[a.wikidata] : null) ?? byName[norm(a.name)] ?? null
  const appleIds = artists.flatMap((a) => {
    const id = appleOf(a)
    return id ? [id] : []
  })
  const songs = await cachedMany("apple-songs", appleIds, MEDIA_LINKS.days.songs, songsOfArtists)
  const out: Record<string, Song[]> = {}
  for (const a of artists) {
    const id = appleOf(a)
    const list = id ? songs[id] : null
    if (list?.length) out[a.qlooId] = list
  }
  return out
}

// ── Podcasts → latest episode ─────────────────────────────────────────────────────────────────

const rss = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
})

/** A feed's date as ISO, or null when it can't be read (some feeds write dates their own way). */
const dateOf = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** "1:02:03", "62:03" or "3723" → seconds. */
const secondsOf = (raw: unknown): number | null => {
  if (typeof raw !== "string" && typeof raw !== "number") return null
  const parts = String(raw).split(":").map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return null
  return parts.reduce((total, n) => total * 60 + n, 0) || null
}

/**
 * The newest episode with audio in a feed. Only the start of the feed is read (big shows run to
 * many megabytes), so the first complete `<item>` is cut out and parsed on its own.
 */
function latestEpisode(xml: string): {
  title: string
  audio: string
  seconds: number | null
  published: string | null
  image: string | null
} | null {
  for (const match of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)) {
    const doc = rss.parse(match[0]) as { item?: Record<string, unknown> }
    const item = doc.item
    const enclosure = item?.enclosure as { "@url"?: string; "@type"?: string } | undefined
    const audio = enclosure?.["@url"]
    if (!item || !audio || !/^https?:\/\//.test(audio)) continue
    if (enclosure?.["@type"] && !enclosure["@type"].startsWith("audio")) continue
    const image = item["itunes:image"] as { "@href"?: string } | undefined
    return {
      title: String(item.title ?? "").trim(),
      audio,
      seconds: secondsOf(item["itunes:duration"]),
      published: dateOf(item.pubDate),
      image: image?.["@href"] ?? null,
    }
  }
  return null
}

async function episodesOf(itunesIds: string[]): Promise<Record<string, Episode | null>> {
  const out: Record<string, Episode | null> = {}
  const tried = itunesIds.slice(0, MEDIA_LINKS.podcasts)
  const body = await itunes("lookup", { id: tried.join(","), entity: "podcast" })
  if (!body?.results) return out
  const shows = new Map(
    body.results.filter((r) => r.collectionId).map((r) => [String(r.collectionId), r]),
  )
  await Promise.all(
    tried.map(async (id) => {
      const show = shows.get(id)
      if (!show?.feedUrl) {
        out[id] = null
        return
      }
      const feed = await fetchPublic(show.feedUrl, {
        maxBytes: MEDIA_LINKS.podcastBytes,
        accept: "application/rss+xml,application/xml,text/xml,*/*",
      })
      // A feed that didn't answer is tried again next time; one with no audio is remembered.
      if (!feed) return
      const latest = latestEpisode(feed.text)
      out[id] = latest
        ? {
            title: latest.title,
            show: show.collectionName ?? "",
            audio: latest.audio,
            store: show.collectionViewUrl ?? null,
            artwork: latest.image ?? show.artworkUrl600 ?? bigArt(show.artworkUrl100),
            seconds: latest.seconds,
            published: latest.published,
          }
        : null
    }),
  )
  return out
}

/** The latest episode of each podcast pick, keyed by the pick's Qloo id. */
export async function episodesFor(
  podcasts: { qlooId: string; itunes?: string }[],
): Promise<Record<string, Episode>> {
  const ids = podcasts.flatMap((p) => (p.itunes && /^\d+$/.test(p.itunes) ? [p.itunes] : []))
  const found = await cachedMany("podcast-latest", ids, MEDIA_LINKS.days.episode, episodesOf)
  const out: Record<string, Episode> = {}
  for (const p of podcasts) {
    const episode = p.itunes ? found[p.itunes] : null
    if (episode) out[p.qlooId] = episode
  }
  return out
}

// ── Films and shows → trailer ─────────────────────────────────────────────────────────────────

/** Whether trailers can be found on this server (TMDB's read token). */
export const trailersReady = () => Boolean(env.TMDB_READ_TOKEN)

type TmdbVideo = { key: string; site: string; type: string; official?: boolean; name: string }

async function trailersOf(imdbIds: string[]): Promise<Record<string, Trailer | null>> {
  const token = env.TMDB_READ_TOKEN
  const out: Record<string, Trailer | null> = {}
  if (!token) return out
  const auth = { headers: { authorization: `Bearer ${token}` } }
  await Promise.all(
    imdbIds.slice(0, MEDIA_LINKS.trailers).map(async (imdb) => {
      const found = await json<{
        movie_results?: { id: number }[]
        tv_results?: { id: number }[]
      }>(`https://api.themoviedb.org/3/find/${imdb}?external_source=imdb_id`, auth)
      if (!found) return
      const movie = found.movie_results?.[0]
      const tv = found.tv_results?.[0]
      const path = movie ? `movie/${movie.id}` : tv ? `tv/${tv.id}` : null
      if (!path) {
        out[imdb] = null
        return
      }
      const videos = await json<{ results?: TmdbVideo[] }>(
        `https://api.themoviedb.org/3/${path}/videos`,
        auth,
      )
      if (!videos) return
      const youtube = (videos.results ?? []).filter((v) => v.site === "YouTube")
      const best =
        youtube.find((v) => v.type === "Trailer" && v.official) ??
        youtube.find((v) => v.type === "Trailer") ??
        youtube.find((v) => v.type === "Teaser") ??
        null
      out[imdb] = best ? { youtube: best.key, title: best.name } : null
    }),
  )
  return out
}

/** The trailer of each film or show pick, keyed by the pick's Qloo id. */
export async function trailersFor(
  titles: { qlooId: string; imdb?: string }[],
): Promise<Record<string, Trailer>> {
  if (!trailersReady()) return {}
  const ids = titles.flatMap((t) => (t.imdb && /^tt\d+$/.test(t.imdb) ? [t.imdb] : []))
  const found = await cachedMany("tmdb-trailer", ids, MEDIA_LINKS.days.trailer, trailersOf)
  const out: Record<string, Trailer> = {}
  for (const t of titles) {
    const trailer = t.imdb ? found[t.imdb] : null
    if (trailer) out[t.qlooId] = trailer
  }
  return out
}

/** A book's cover by ISBN-13 from Open Library, for books Qloo has no image for. */
export const coverOf = (isbn13?: string) =>
  isbn13 && /^\d{13}$/.test(isbn13)
    ? `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg?default=false`
    : null

// ── One call for a page of picks ──────────────────────────────────────────────────────────────

export type CardMedia =
  | { kind: "songs"; songs: Song[] }
  | { kind: "episode"; episode: Episode }
  | { kind: "trailer"; trailer: Trailer }
  | { kind: "cover"; image: string }

type PickIds = {
  qlooId: string
  type: string
  name: string
  image: string | null
  ids?: { wikidata?: string; imdb?: string; itunes?: string; isbn13?: string }
}

/**
 * Whatever each pick can play or show, in one batched pass (one Wikidata and one iTunes request
 * for all the page's artists, a few feeds, a few trailers). Picks with nothing get no entry.
 */
export async function mediaFor(picks: PickIds[]): Promise<Record<string, CardMedia>> {
  const of = (type: string) => picks.filter((p) => p.type === `urn:entity:${type}`)
  const [songs, episodes, trailers] = await Promise.all([
    songsFor(
      of("artist").map((p) => ({ qlooId: p.qlooId, name: p.name, wikidata: p.ids?.wikidata })),
    ).catch(() => ({}) as Record<string, Song[]>),
    episodesFor(of("podcast").map((p) => ({ qlooId: p.qlooId, itunes: p.ids?.itunes }))).catch(
      () => ({}) as Record<string, Episode>,
    ),
    trailersFor(
      [...of("movie"), ...of("tv_show")].map((p) => ({ qlooId: p.qlooId, imdb: p.ids?.imdb })),
    ).catch(() => ({}) as Record<string, Trailer>),
  ])
  const out: Record<string, CardMedia> = {}
  for (const [id, list] of Object.entries(songs)) out[id] = { kind: "songs", songs: list }
  for (const [id, episode] of Object.entries(episodes)) out[id] = { kind: "episode", episode }
  for (const [id, trailer] of Object.entries(trailers)) out[id] = { kind: "trailer", trailer }
  for (const book of of("book")) {
    const cover = book.image ? null : coverOf(book.ids?.isbn13)
    if (cover) out[book.qlooId] = { kind: "cover", image: cover }
  }
  return out
}
