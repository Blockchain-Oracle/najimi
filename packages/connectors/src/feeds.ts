import { IMPORTS } from "@najimi/config"
import { env } from "@najimi/env/server"
import { XMLParser } from "fast-xml-parser"

/*
 * Taste that already lives elsewhere, read by username with no sign-in: a Letterboxd diary, a
 * Goodreads shelf, Last.fm top artists, and pasted X or Instagram handles. Each returns
 * candidates; resolve.ts matches them to Qloo (by exact external id where there is one).
 * Every URL is built here from a validated name, never taken from the person.
 */

export type ExternalKind = "goodreads" | "musicbrainz" | "twitter" | "instagram"

export type Candidate = {
  name: string
  /** `urn:entity:movie`…, or null when only the handle is known. */
  type: string | null
  year?: number
  external?: { kind: ExternalKind; id: string }
  /** When the handle isn't in Qloo, try the display name, accepting only an exact match. */
  exactName?: boolean
}

export class ImportError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "not_found" | "unavailable" | "empty",
  ) {
    super(message)
    this.name = "ImportError"
  }
}

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": IMPORTS.userAgent, accept: "application/rss+xml,application/xml,*/*" },
    signal: AbortSignal.timeout(IMPORTS.fetchTimeoutMs),
    redirect: "follow",
  }).catch(() => null)
  if (!response)
    throw new ImportError("That site didn't answer. Try again in a moment.", "unavailable")
  if (response.status === 404)
    throw new ImportError("No public profile with that name.", "not_found")
  if (!response.ok)
    throw new ImportError("That site didn't answer. Try again in a moment.", "unavailable")
  const text = await response.text()
  if (text.length > IMPORTS.maxFeedBytes) return text.slice(0, IMPORTS.maxFeedBytes)
  return text
}

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

type RssItem = Record<string, string | undefined>

function rssItems(xml: string): RssItem[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } } }
  return asArray(doc.rss?.channel?.item)
}

const dedupe = (all: Candidate[]) => {
  const seen = new Set<string>()
  return all.filter((c) => {
    const key = `${c.type}:${c.external?.id ?? c.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** A Letterboxd diary: films they loved or rated well first (liked, then 4★ and up). */
export async function letterboxd(input: string): Promise<Candidate[]> {
  const user = input
    .trim()
    .replace(/^https?:\/\/(www\.)?letterboxd\.com\//i, "")
    .replace(/^@/, "")
    .split("/")[0]
  if (!user || !/^[A-Za-z0-9_]{2,30}$/.test(user))
    throw new ImportError("That isn't a Letterboxd username.", "invalid")
  const items = rssItems(await fetchText(`https://letterboxd.com/${user}/rss/`))
  const films = items
    .filter((i) => i["letterboxd:filmTitle"])
    .map((i) => ({
      title: String(i["letterboxd:filmTitle"]),
      year: Number(i["letterboxd:filmYear"]) || undefined,
      liked: i["letterboxd:memberLike"] === "Yes",
      rating: Number(i["letterboxd:memberRating"]) || 0,
    }))
    .sort((a, b) => Number(b.liked) - Number(a.liked) || b.rating - a.rating)
  const out = dedupe(
    films.map((f) => ({ name: f.title, type: "urn:entity:movie", year: f.year })),
  ).slice(0, IMPORTS.maxItems)
  if (!out.length) throw new ImportError("No films in that diary yet.", "empty")
  return out
}

/** A Goodreads shelf (read), best-rated first; book ids match Qloo exactly. */
export async function goodreads(input: string): Promise<Candidate[]> {
  const id = /(\d{1,12})/.exec(input.trim())?.[1]
  if (!id) throw new ImportError("Paste your Goodreads profile link or user number.", "invalid")
  const items = rssItems(
    await fetchText(`https://www.goodreads.com/review/list_rss/${id}?shelf=read`),
  )
  const books = items
    .filter((i) => i.book_id && i.title)
    .map((i) => ({
      title: String(i.title),
      bookId: String(i.book_id),
      rating: Number(i.user_rating) || 0,
    }))
    .sort((a, b) => b.rating - a.rating)
  const out = dedupe(
    books.map((b) => ({
      name: b.title,
      type: "urn:entity:book",
      external: { kind: "goodreads" as const, id: b.bookId },
    })),
  ).slice(0, IMPORTS.maxItems)
  if (!out.length) throw new ImportError("No books on that shelf, or it's private.", "empty")
  return out
}

/** Whether Last.fm can be offered on this server. */
export const lastfmReady = () => Boolean(env.LASTFM_API_KEY)

/** Last.fm's top artists over six months; MusicBrainz ids match Qloo exactly. */
export async function lastfm(input: string): Promise<Candidate[]> {
  const key = env.LASTFM_API_KEY
  if (!key) throw new ImportError("Last.fm isn't connected on this server yet.", "unavailable")
  const user = input
    .trim()
    .replace(/^https?:\/\/(www\.)?last\.fm\/user\//i, "")
    .split("/")[0]
  if (!user || !/^[A-Za-z0-9_-]{2,30}$/.test(user))
    throw new ImportError("That isn't a Last.fm username.", "invalid")
  const params = new URLSearchParams({
    method: "user.gettopartists",
    user,
    api_key: key,
    format: "json",
    period: "6month",
    limit: String(IMPORTS.maxItems),
  })
  const text = await fetchText(`https://ws.audioscrobbler.com/2.0/?${params}`)
  const body = JSON.parse(text) as {
    error?: number
    topartists?: { artist?: { name: string; mbid?: string }[] }
  }
  if (body.error === 6) throw new ImportError("No Last.fm user with that name.", "not_found")
  const out = (body.topartists?.artist ?? []).map((a) => ({
    name: a.name,
    type: "urn:entity:artist",
    ...(a.mbid ? { external: { kind: "musicbrainz" as const, id: a.mbid } } : {}),
  }))
  if (!out.length) throw new ImportError("No listening on that profile yet.", "empty")
  return out
}

/**
 * Pasted handles: `@burnaboy`, `x.com/burnaboy`, `instagram.com/nike`. A bare handle is tried as
 * both an X and an Instagram account; Qloo knows artists, brands, places and people by both.
 */
export function handles(input: string): Candidate[] {
  const out: Candidate[] = []
  for (const raw of input.split(/[\s,]+/).filter(Boolean)) {
    const url =
      /^(?:https?:\/\/)?(?:www\.)?(x|twitter|instagram)\.com\/@?([A-Za-z0-9_.]{1,30})/i.exec(raw)
    const bare = /^@?([A-Za-z0-9_.]{2,30})$/.exec(raw)
    if (url?.[1] && url[2]) {
      const kind = url[1].toLowerCase() === "instagram" ? "instagram" : "twitter"
      out.push({ name: url[2], type: null, external: { kind, id: url[2].toLowerCase() } })
    } else if (bare?.[1]) {
      const id = bare[1].toLowerCase()
      out.push({ name: bare[1], type: null, external: { kind: "twitter", id } })
      out.push({ name: bare[1], type: null, external: { kind: "instagram", id } })
    }
    if (out.length >= IMPORTS.maxHandles * 2) break
  }
  if (!out.length) throw new ImportError("Paste one or more @handles or profile links.", "invalid")
  return out
}
