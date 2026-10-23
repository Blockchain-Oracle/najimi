import { EXPORTS } from "@najimi/config"
import type { Candidate } from "./feeds"

/*
 * Data downloads, read on the person's own device (W14): X, Instagram, TikTok, Spotify and
 * YouTube (Google Takeout) each let anyone download what they follow and love. The archive is
 * opened in the browser; only short lists leave it (handles, artist and channel names, and a few
 * dozen titles or posts to read for the culture they name), to be matched to Qloo.
 * Pure: no network, so each format is tested on its own. Formats change between export versions,
 * so every reader accepts the old and the new shapes.
 */

export type ExportPlatform = "x" | "instagram" | "tiktok" | "spotify" | "youtube"

/** What a download held, ready to match. */
export type ExportContents = {
  /** Matched to Qloo by handle or exact name. */
  candidates: Candidate[]
  /** Read for the culture they name: liked posts, watched titles, favourite sounds. */
  texts: string[]
  /** How much each list held, for the sheet to say what it read. */
  counts: Record<string, number>
}

/** Which files inside each archive matter (matched on the end of the path, any language). */
export const EXPORT_FILES: Record<ExportPlatform, RegExp> = {
  x: /(?:^|\/)(?:following|like)(?:-part\d+)?\.js$/i,
  instagram: /(?:^|\/)(following|liked_posts|saved_posts)\.json$/i,
  tiktok: /(?:^|\/)user_data(?:_tiktok)?\.json$/i,
  spotify: /(?:^|\/)YourLibrary\.json(?:\.json)?$/i,
  youtube: /(?:^|\/)(subscriptions\.csv|watch-history\.json)$/i,
}

/** How many candidates one export may send (the strongest first). */
export const EXPORT_MAX = 120

const handleOf = (s: unknown) =>
  typeof s === "string" && /^[A-Za-z0-9_.]{1,30}$/.test(s) ? s.toLowerCase() : null

const parse = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const rank = (counts: Map<string, number>) => [...counts].sort((a, b) => b[1] - a[1])

const bumper = (counts: Map<string, number>) => (key: string | null, by: number) => {
  if (key) counts.set(key, (counts.get(key) ?? 0) + by)
}

const empty = (): ExportContents => ({ candidates: [], texts: [], counts: {} })

// ── X ─────────────────────────────────────────────────────────────────────────────────────────

/** X wraps each file's JSON in a script: `window.YTD.like.part0 = [...]`. */
export function ytd(text: string): unknown[] {
  const data = parse(text.replace(/^\s*window\.YTD\.[\w.]+\s*=\s*/, ""))
  return Array.isArray(data) ? data : []
}

/** A liked post's words, without its links and HTML entities. */
const postText = (s: string) =>
  s
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()

/**
 * X's archive: the words of what you liked. It lists who you follow only by account number, which
 * X answers only for a signed-in account, and a connected X reads its follows directly; so the
 * follows are counted here, not looked up.
 */
export function xContents(files: Record<string, string>): ExportContents {
  const out = empty()
  let following = 0
  const likes: string[] = []
  for (const [path, text] of Object.entries(files)) {
    if (/following(?:-part\d+)?\.js$/i.test(path)) following += ytd(text).length
    else if (/like(?:-part\d+)?\.js$/i.test(path))
      for (const row of ytd(text) as { like?: { fullText?: string } }[]) {
        const words = postText(row.like?.fullText ?? "")
        if (words.length >= 8) likes.push(words)
      }
  }
  out.texts = likes.slice(0, EXPORTS.texts)
  out.counts = { following, likes: likes.length }
  return out
}

// ── Instagram ─────────────────────────────────────────────────────────────────────────────────

type IgRow = {
  title?: string
  string_list_data?: { value?: string; href?: string }[]
  label_values?: { label?: string; title?: string; value?: string; dict?: unknown[] }[]
}

/** The handle in a following row: `title` in new exports, the value or the link's end in old. */
const igFollowed = (row: IgRow) =>
  handleOf(row.title) ??
  handleOf(row.string_list_data?.[0]?.value) ??
  handleOf(row.string_list_data?.[0]?.href?.split("/").filter(Boolean).pop())

/** Newer liked-post exports name the post's owner deep inside `label_values`. */
function igOwner(row: IgRow): string | null {
  const walk = (node: unknown): string | null => {
    if (!node || typeof node !== "object") return null
    const n = node as { label?: string; value?: string; dict?: unknown[] }
    if (n.label === "Username") return handleOf(n.value)
    for (const child of n.dict ?? []) {
      const found = walk(child)
      if (found) return found
    }
    return null
  }
  for (const v of row.label_values ?? []) {
    const found = walk(v)
    if (found) return found
  }
  return null
}

/** Instagram (JSON): who you follow, whose posts you liked and saved, strongest first. */
export function instagramContents(files: Record<string, string>): ExportContents {
  const counts = new Map<string, number>()
  const bump = bumper(counts)
  const seen = { following: 0, liked: 0, saved: 0 }
  for (const [path, text] of Object.entries(files)) {
    const data = parse(text) as Record<string, unknown> | unknown[] | null
    if (!data) continue
    const list = (key: string) =>
      (Array.isArray(data) ? data : ((data as Record<string, unknown>)[key] ?? [])) as IgRow[]
    if (/following\.json$/i.test(path)) {
      for (const row of list("relationships_following")) bump(igFollowed(row), 3)
      seen.following += list("relationships_following").length
    } else if (/liked_posts\.json$/i.test(path)) {
      for (const row of list("likes_media_likes")) bump(handleOf(row.title) ?? igOwner(row), 1)
      seen.liked += list("likes_media_likes").length
    } else if (/saved_posts\.json$/i.test(path)) {
      for (const row of list("saved_saved_media")) bump(handleOf(row.title) ?? igOwner(row), 2)
      seen.saved += list("saved_saved_media").length
    }
  }
  return {
    ...empty(),
    candidates: rank(counts)
      .slice(0, EXPORT_MAX)
      .map(([h]) => ({ name: h, type: null, external: { kind: "instagram" as const, id: h } })),
    counts: seen,
  }
}

// ── TikTok ────────────────────────────────────────────────────────────────────────────────────

type Section = Record<string, unknown> | undefined

/** A list in TikTok's file, wherever this export version keeps it. */
function tiktokList(root: Record<string, unknown>, names: string[], key: string): unknown[] {
  const homes = ["Likes and Favorites", "Your Activity", "Activity", "activity"].map(
    (h) => root[h] as Section,
  )
  for (const home of homes)
    for (const name of names) {
      const section = home?.[name] as Section
      const list = section?.[key]
      if (Array.isArray(list)) return list
    }
  return []
}

/** A sound's name from its link (`/music/Essence-feat-Tems-6948034321853238022`). */
export function soundName(link: string): string | null {
  const m = /\/music\/([^/?#]+?)-(\d{6,})(?:[/?#]|$)/.exec(link)
  if (!m?.[1]) return null
  const name = decodeURIComponent(m[1]).replace(/-/g, " ").trim()
  return name.length >= 2 && !/^original sound/i.test(name) ? name : null
}

/**
 * TikTok (JSON): the accounts you follow and your favourite sounds. Its likes, favourites and
 * watch history are bare video links with no creator, so they're counted, not guessed at.
 */
export function tiktokContents(files: Record<string, string>): ExportContents {
  const out = empty()
  for (const text of Object.values(files)) {
    const root = parse(text) as Record<string, unknown> | null
    if (!root || Array.isArray(root)) continue
    const following = tiktokList(root, ["Following", "Following List"], "Following") as {
      UserName?: string
    }[]
    for (const f of following) {
      const h = handleOf(f.UserName)
      // Creators often keep one handle everywhere: it's tried as Instagram on Qloo.
      if (h) out.candidates.push({ name: h, type: null, external: { kind: "instagram", id: h } })
    }
    const sounds = tiktokList(root, ["Favorite Sounds"], "FavoriteSoundList") as {
      Link?: string
      link?: string
    }[]
    for (const s of sounds) {
      const name = soundName(s.Link ?? s.link ?? "")
      if (name) out.texts.push(`A favourite TikTok sound: ${name}`)
    }
    out.counts = {
      following: following.length,
      sounds: sounds.length,
      liked: tiktokList(root, ["Like List"], "ItemFavoriteList").length,
      favourites: tiktokList(root, ["Favorite Videos"], "FavoriteVideoList").length,
      watched: tiktokList(root, ["Watch History", "Video Browsing History"], "VideoList").length,
    }
  }
  out.candidates = out.candidates.slice(0, EXPORT_MAX)
  out.texts = out.texts.slice(0, EXPORTS.texts)
  return out
}

// ── Spotify ───────────────────────────────────────────────────────────────────────────────────

/** Spotify: the artists in your library (most saved first) and the shows you follow. */
export function spotifyContents(files: Record<string, string>): ExportContents {
  const artists = new Map<string, number>()
  const bump = bumper(artists)
  const shows: string[] = []
  let tracks = 0
  for (const text of Object.values(files)) {
    const data = parse(text) as {
      artists?: { name?: string }[]
      tracks?: { artist?: string }[]
      albums?: { artist?: string }[]
      shows?: { name?: string }[]
    } | null
    if (!data) continue
    for (const a of data.artists ?? []) bump(a.name?.trim() || null, 5)
    for (const a of data.albums ?? []) bump(a.artist?.trim() || null, 2)
    for (const t of data.tracks ?? []) bump(t.artist?.trim() || null, 1)
    tracks += data.tracks?.length ?? 0
    for (const s of data.shows ?? []) if (s.name) shows.push(s.name)
  }
  return {
    ...empty(),
    candidates: [
      ...rank(artists).map(([name]) => ({ name, type: "urn:entity:artist" })),
      ...shows.map((name) => ({ name, type: "urn:entity:podcast" })),
    ].slice(0, EXPORT_MAX),
    counts: { artists: artists.size, tracks, shows: shows.length },
  }
}

// ── YouTube (Google Takeout) ──────────────────────────────────────────────────────────────────

/** One CSV line into cells (quoted cells may hold commas). */
function cells(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === "," && !quoted) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out
}

/** An artist's auto-made channel ("Tems - Topic") and label channels ("TemsVEVO") name the artist. */
export const channelName = (title: string) =>
  title
    .replace(/\s+-\s+Topic$/i, "")
    .replace(/VEVO$/, "")
    .trim()

type Watch = {
  header?: string
  title?: string
  titleUrl?: string
  subtitles?: { name?: string }[]
  details?: unknown[]
}

/**
 * YouTube (Takeout): the artists you play most (YouTube Music's "Topic" channels), the channels
 * you subscribe to (the CSV's third column; its header is in your language), and the newest
 * titles you watched.
 */
export function youtubeContents(files: Record<string, string>): ExportContents {
  const subscribed: string[] = []
  const watched = new Map<string, number>()
  const artists = new Set<string>()
  const titles: string[] = []
  let entries = 0
  for (const [path, text] of Object.entries(files)) {
    if (/subscriptions\.csv$/i.test(path)) {
      const lines = text.split(/\r?\n/).filter(Boolean)
      const header = cells(lines[0] ?? "").map((h) => h.trim().toLowerCase())
      const found = header.findIndex((h) => h.includes("title"))
      const column = found >= 0 ? found : 2
      for (const line of lines.slice(1)) {
        const name = cells(line)[column]?.trim()
        if (name) subscribed.push(channelName(name))
      }
    } else if (/watch-history\.json$/i.test(path)) {
      const rows = parse(text)
      if (!Array.isArray(rows)) continue
      for (const row of rows as Watch[]) {
        const channel = row.subtitles?.[0]?.name
        // Removed videos, ads and visits have no channel or no link.
        if (!channel || !row.titleUrl || row.details?.length) continue
        entries++
        const name = channelName(channel)
        watched.set(name, (watched.get(name) ?? 0) + 1)
        if (row.header === "YouTube Music" || /\s-\sTopic$/i.test(channel)) artists.add(name)
        if (titles.length < EXPORTS.texts && row.title)
          titles.push(`${row.title.replace(/^Watched\s+/, "")} (${name})`)
      }
    }
  }
  const named = new Set<string>()
  const candidates: Candidate[] = []
  const add = (name: string) => {
    if (name.length < 2 || named.has(name.toLowerCase())) return
    named.add(name.toLowerCase())
    candidates.push({ name, type: artists.has(name) ? "urn:entity:artist" : null, exactName: true })
  }
  // Watched channels count only when they're artists (YouTube Music's "Topic" channels): any other
  // channel's name could match an unrelated place or brand. Subscriptions were chosen, so they all
  // count, and what was watched is read from its titles.
  for (const [name] of rank(watched)) if (artists.has(name)) add(name)
  for (const name of subscribed) add(name)
  return {
    ...empty(),
    candidates: candidates.slice(0, EXPORT_MAX),
    texts: titles,
    counts: { subscriptions: subscribed.length, watched: entries },
  }
}

export function exportContents(
  platform: ExportPlatform,
  files: Record<string, string>,
): ExportContents {
  if (platform === "x") return xContents(files)
  if (platform === "instagram") return instagramContents(files)
  if (platform === "tiktok") return tiktokContents(files)
  if (platform === "spotify") return spotifyContents(files)
  return youtubeContents(files)
}
