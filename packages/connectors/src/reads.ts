import { SOCIAL } from "@najimi/config"
import type { Candidate } from "./feeds"

/*
 * What a connected account or public profile holds, as things Qloo can match: accounts followed
 * (by handle, matched on Qloo's own X/Instagram ids), the owners of posts liked or saved, and the
 * songs on reels and TikToks (by artist). Followed accounts first: they're the clearest signal.
 * Pure, so it's tested without a network.
 */

const HANDLE = /^[a-z0-9_.]{1,30}$/

type Account = { username: string | null; name?: string | null }
type Post = { owner?: string | null; ownerName?: string | null; music?: { artist: string } | null }

/** One list, best first, no repeats, capped for Qloo. */
export function candidatesFrom(input: {
  platform: "x" | "instagram" | "tiktok"
  following?: Account[]
  posts?: Post[]
}): Candidate[] {
  const out: Candidate[] = []
  const seen = new Set<string>()
  const kind =
    input.platform === "x" ? "twitter" : input.platform === "instagram" ? "instagram" : null
  const add = (c: Candidate) => {
    const key = c.external
      ? `${c.external.kind}:${c.external.id}`
      : `${c.type}:${c.name.toLowerCase()}`
    if (seen.has(key) || out.length >= SOCIAL.resolveMax) return
    seen.add(key)
    out.push(c)
  }
  const byHandle = (a: Account) => {
    const handle = a.username?.toLowerCase().replace(/^@/, "") ?? ""
    if (!kind || !HANDLE.test(handle)) return
    const name = a.name?.trim() || handle
    add({
      name,
      type: null,
      external: { kind, id: handle },
      // A real display name ("Drake", not "drake") can be found by name when the handle can't.
      ...(name.toLowerCase() !== handle ? { exactName: true } : {}),
    })
  }
  const following = input.following ?? []
  // Two thirds of the room for who they follow, the rest for what they liked; then fill up.
  const firstPart = Math.ceil((SOCIAL.resolveMax * 2) / 3)
  for (const a of following.slice(0, firstPart)) byHandle(a)
  for (const p of input.posts ?? []) {
    for (const artist of artistsIn(p.music?.artist))
      add({ name: artist, type: "urn:entity:artist" })
    if (p.owner) byHandle({ username: p.owner, name: p.ownerName })
  }
  for (const a of following.slice(firstPart)) byHandle(a)
  return out
}

/** "Wizkid, Tems" and "Burna Boy ft. Ed Sheeran" are two artists each. */
export function artistsIn(credit: string | null | undefined): string[] {
  if (!credit) return []
  return credit
    .split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b|\bwith\b)\s*/i)
    .map((a) => a.trim())
    .filter((a) => a.length > 1)
    .slice(0, 2)
}
