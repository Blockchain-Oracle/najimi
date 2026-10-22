import type { Candidate } from "./feeds"

/*
 * Data exports, read on the person's own device (W14): Instagram, TikTok, Spotify and YouTube
 * (Google Takeout) let anyone download what they follow and love. The archive is opened in the
 * browser; only these short lists (handles, artist and channel names) are sent on, to be matched
 * to Qloo. Pure: no network, so each format is tested on its own.
 */

export type ExportPlatform = "instagram" | "tiktok" | "spotify" | "youtube"

/** Which files inside each archive matter (matched on the end of the path). */
export const EXPORT_FILES: Record<ExportPlatform, RegExp> = {
  instagram: /(?:^|\/)(following|liked_posts|saved_posts)\.json$/i,
  tiktok: /(?:^|\/)user_data(?:_tiktok)?\.json$/i,
  spotify: /(?:^|\/)YourLibrary\.json$/i,
  youtube: /(?:^|\/)subscriptions\.csv$/i,
}

/** How many candidates one export may send (the strongest first). */
export const EXPORT_MAX = 120

const handleOf = (s: unknown) =>
  typeof s === "string" && /^[A-Za-z0-9_.]{1,30}$/.test(s) ? s.toLowerCase() : null

/** Instagram (JSON export): who you follow, whose posts you liked and saved. */
export function instagramCandidates(files: Record<string, string>): Candidate[] {
  const counts = new Map<string, number>()
  const bump = (h: string | null, by: number) => h && counts.set(h, (counts.get(h) ?? 0) + by)
  for (const [path, text] of Object.entries(files)) {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      continue
    }
    const list = (key: string) =>
      ((data as Record<string, unknown>)[key] as
        | { string_list_data?: { value?: string; href?: string }[]; title?: string }[]
        | undefined) ?? []
    if (/following\.json$/i.test(path)) {
      // Older exports are a bare list; newer ones wrap it.
      const rows = Array.isArray(data) ? data : list("relationships_following")
      for (const row of rows as { string_list_data?: { value?: string }[]; title?: string }[])
        bump(handleOf(row.string_list_data?.[0]?.value ?? row.title), 3)
    } else if (/liked_posts\.json$/i.test(path)) {
      for (const row of list("likes_media_likes")) bump(handleOf(row.title), 1)
    } else if (/saved_posts\.json$/i.test(path)) {
      for (const row of list("saved_saved_media")) bump(handleOf(row.title), 2)
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, EXPORT_MAX)
    .map(([h]) => ({ name: h, type: null, external: { kind: "instagram" as const, id: h } }))
}

/** TikTok: the accounts you follow (names only; TikTok's own ids aren't in Qloo). */
export function tiktokCandidates(files: Record<string, string>): Candidate[] {
  const out: Candidate[] = []
  for (const text of Object.values(files)) {
    let data: Record<string, unknown>
    try {
      data = JSON.parse(text)
    } catch {
      continue
    }
    const activity = (data.Activity ?? data.activity) as Record<string, unknown> | undefined
    const following =
      (activity?.["Following List"] as { Following?: { UserName?: string }[] } | undefined)
        ?.Following ?? []
    for (const f of following) {
      const h = handleOf(f.UserName)
      // Creators often keep one handle everywhere: try it as Instagram and X too.
      if (h) out.push({ name: h, type: null, external: { kind: "instagram", id: h } })
    }
  }
  return out.slice(0, EXPORT_MAX)
}

/** Spotify: the artists in your library (and the shows you follow). */
export function spotifyCandidates(files: Record<string, string>): Candidate[] {
  const out: Candidate[] = []
  for (const text of Object.values(files)) {
    let data: { artists?: { name?: string }[]; shows?: { name?: string }[] }
    try {
      data = JSON.parse(text)
    } catch {
      continue
    }
    for (const a of data.artists ?? [])
      if (a.name) out.push({ name: a.name, type: "urn:entity:artist" })
    for (const s of data.shows ?? [])
      if (s.name) out.push({ name: s.name, type: "urn:entity:podcast" })
  }
  return out.slice(0, EXPORT_MAX)
}

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

/** YouTube (Takeout): the channels you subscribe to, by title. */
export function youtubeCandidates(files: Record<string, string>): Candidate[] {
  const out: Candidate[] = []
  for (const text of Object.values(files)) {
    const lines = text.split(/\r?\n/).filter(Boolean)
    const header = cells(lines[0] ?? "").map((h) => h.trim().toLowerCase())
    const title = header.findIndex((h) => h.includes("title"))
    if (title < 0) continue
    for (const line of lines.slice(1)) {
      const name = cells(line)[title]?.trim()
      if (name) out.push({ name, type: null })
    }
  }
  return out.slice(0, EXPORT_MAX)
}

export function candidatesFromExport(platform: ExportPlatform, files: Record<string, string>) {
  if (platform === "instagram") return instagramCandidates(files)
  if (platform === "tiktok") return tiktokCandidates(files)
  if (platform === "spotify") return spotifyCandidates(files)
  return youtubeCandidates(files)
}
