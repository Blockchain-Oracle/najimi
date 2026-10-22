import { SOCIAL } from "@najimi/config"
import { instagram } from "@najimi/connectors/bridge"
import { PlatformError } from "@najimi/connectors/errors"
import { candidatesFrom } from "@najimi/connectors/reads"
import {
  type Connection,
  connectionOf,
  noteConnection,
  poolOf,
  secretOf,
} from "@najimi/connectors/sessions"
import { accountsInTweets, textsOf, xFollowing, xPublic, xSaved } from "@najimi/connectors/x"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { CHARS, POSTS } from "@/lib/named-things"
import { allow } from "@/lib/rate-limit"

type Params = { params: Promise<{ platform: string }> }

const input = z.object({
  /** Someone's public handle; empty reads the connected account itself. */
  handle: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9_.]{1,30}$/)
    .optional(),
})

/** Post words for the next step (the things named in them), trimmed. */
const words = (texts: string[]) =>
  texts
    .filter(Boolean)
    .slice(0, POSTS)
    .map((t) => t.slice(0, CHARS))

/** Keeps a connection's health up to date whatever the platform answered. */
async function using<T>(c: Connection, run: () => Promise<T>): Promise<T> {
  try {
    const out = await run()
    await noteConnection(c, { ok: true })
    return out
  } catch (e) {
    if (e instanceof PlatformError)
      await noteConnection(c, {
        ok: false,
        error: e.message,
        status: e.expired ? (e.code === "locked" ? "locked" : "expired") : undefined,
      })
    throw e
  }
}

/**
 * What an X or Instagram account follows and likes, as candidates for Qloo (matched by the
 * import route, so the screen can show each step). A connected account reads its own following,
 * likes and saves; a public handle is read logged out (X) or with Najimi's reading account
 * (Instagram).
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const platform = (await params).platform
  if (platform !== "x" && platform !== "instagram") return fail("Not a platform Najimi reads", 404)
  const me = auth.session.user.id
  if (!allow(`social-read:${me}`, SOCIAL.readsPerHour, 60 * 60_000))
    return fail("That's enough reading for this hour", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const handle = parsed.data.handle?.replace(/^@/, "") || null
  const own = await connectionOf(me, platform)

  try {
    if (platform === "x") {
      if (own && (!handle || handle.toLowerCase() === own.handle?.toLowerCase())) {
        const key = secretOf(own)
        const [following, liked] = await using(own, () =>
          Promise.all([xFollowing(key), xSaved(key, "likes").catch(() => [])]),
        )
        const posts = accountsInTweets(liked, own.handle ?? undefined).map((a) => ({
          owner: a.username,
          ownerName: a.name,
        }))
        return json({
          label: `@${own.handle}`,
          counts: { following: following.length, posts: liked.length },
          candidates: candidatesFrom({ platform, following, posts }),
          texts: words(textsOf(liked)),
        })
      }
      if (!handle) return fail("Type an X handle, or connect your X", 400)
      const { account, tweets } = await xPublic(handle, own ? secretOf(own) : undefined)
      const shared = accountsInTweets(tweets, account.username).map((a) => ({
        owner: a.username,
        ownerName: a.name,
      }))
      return json({
        label: `@${account.username}`,
        counts: { following: 0, posts: tweets.length },
        candidates: candidatesFrom({ platform, posts: shared }),
        texts: words(textsOf(tweets)),
      })
    }

    // Instagram: the person's own session, or Najimi's reading account for someone else's handle.
    if (own && (!handle || handle.toLowerCase() === own.handle?.toLowerCase())) {
      const settings = JSON.parse(secretOf(own)) as Record<string, unknown>
      const read = await using(own, async () => {
        const f = await instagram.following(settings)
        const liked = await instagram.posts(f.settings, "liked").catch(() => null)
        const saved = await instagram
          .posts(liked?.settings ?? f.settings, "saved")
          .catch(() => null)
        await noteConnection(own, {
          ok: true,
          session: JSON.stringify(saved?.settings ?? liked?.settings ?? f.settings),
        })
        return { following: f.accounts, posts: [...(liked?.posts ?? []), ...(saved?.posts ?? [])] }
      })
      return json({
        label: `@${own.handle}`,
        counts: { following: read.following.length, posts: read.posts.length },
        candidates: candidatesFrom({ platform, ...read }),
        texts: words(read.posts.map((p) => p.caption)),
      })
    }
    if (!handle) return fail("Type an Instagram handle, or connect your Instagram", 400)
    const [reader] = await poolOf("instagram")
    if (!reader)
      return fail(
        "Najimi can't read other Instagram accounts yet. Connect your own, or bring your export.",
        409,
      )
    const settings = JSON.parse(secretOf(reader)) as Record<string, unknown>
    const f = await using(reader, () => instagram.following(settings, handle))
    await noteConnection(reader, { ok: true, session: JSON.stringify(f.settings) })
    return json({
      label: `@${handle}`,
      counts: { following: f.accounts.length, posts: 0 },
      candidates: candidatesFrom({ platform, following: f.accounts }),
      texts: [],
    })
  } catch (e) {
    if (e instanceof PlatformError)
      return fail(e.message, e.code === "not_found" ? 404 : e.code === "bridge" ? 503 : 409)
    console.error("[socials] read", e)
    return fail("That didn't work. Try again in a moment.", 502)
  }
}
