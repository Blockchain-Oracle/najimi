import { SOCIAL } from "@najimi/config"
import { instagram } from "@najimi/connectors/bridge"
import { PlatformError } from "@najimi/connectors/errors"
import {
  disconnect,
  saveConnection,
  setAgents,
  vaultReady,
  viewOf,
} from "@najimi/connectors/sessions"
import { dayIn } from "@najimi/connectors/today"
import { xKeyFrom, xWhoAmI } from "@najimi/connectors/x"
import { enqueue } from "@najimi/jobs"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { allow } from "@/lib/rate-limit"

type Params = { params: Promise<{ platform: string }> }

const PLATFORMS = ["x", "instagram"] as const
const platformOf = (p: string) =>
  (PLATFORMS as readonly string[]).includes(p) ? (p as (typeof PLATFORMS)[number]) : null

const tz = z.string().max(64).optional()
const connectX = z.object({
  key: z.string().max(2000).optional(),
  authToken: z.string().max(200).optional(),
  ct0: z.string().max(400).optional(),
  twid: z.string().max(200).optional(),
  tz,
})
const connectInstagram = z.object({ sessionid: z.string().min(30).max(400), tz })

const failure = (e: unknown) =>
  e instanceof PlatformError
    ? fail(e.message, e.code === "invalid" ? 400 : e.code === "bridge" ? 503 : 409)
    : fail("That didn't work. Try again in a moment.", 502)

/**
 * Connects someone's own account with its session cookies (sealed at once, never shown again) so
 * Najimi can read what they follow and, when they say so, act for them.
 */
export async function POST(request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const platform = platformOf((await params).platform)
  if (!platform) return fail("Not a platform Najimi connects", 404)
  if (!vaultReady()) return fail("Connecting accounts isn't switched on yet", 503)
  const me = auth.session.user.id
  if (!allow(`connect:${me}`, 6, 60 * 60_000)) return fail("That's enough tries for now", 429)
  try {
    if (platform === "x") {
      const parsed = await body(request, connectX)
      if ("error" in parsed) return parsed.error
      const key = xKeyFrom(parsed.data)
      const account = await xWhoAmI(key)
      const row = await saveConnection({
        userId: me,
        platform,
        accountId: account.id,
        handle: account.username,
        name: account.name,
        image: account.image,
        session: key,
        tz: parsed.data.tz,
      })
      return json({ connection: viewOf(row) })
    }
    const parsed = await body(request, connectInstagram)
    if ("error" in parsed) return parsed.error
    // As the browser keeps it (still URL-encoded): that's the form Instagram reads back.
    const { settings, account } = await instagram.connect(parsed.data.sessionid.trim())
    const row = await saveConnection({
      userId: me,
      platform,
      accountId: account.id,
      handle: account.username,
      name: account.name,
      image: account.image,
      session: JSON.stringify(settings),
      tz: parsed.data.tz,
    })
    return json({ connection: viewOf(row) })
  } catch (e) {
    return failure(e)
  }
}

const patch = z.object({
  autopilot: z.boolean().optional(),
  likes: z.boolean().optional(),
  posts: z.enum(["off", "ask", "auto"]).optional(),
  /** Pause every agent on this platform for a day, or carry on. */
  paused: z.boolean().optional(),
  tz,
})

/**
 * The agents on this account: follow ("Do it for me"), like and post, on or off, or all paused
 * for a day. Switching follow or like on starts today's run straight away.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const platform = platformOf((await params).platform)
  if (!platform) return fail("Not a platform Najimi connects", 404)
  const parsed = await body(request, patch)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  const { autopilot, likes, posts, paused, tz: zone } = parsed.data
  const row = await setAgents(
    me,
    platform,
    {
      autopilot,
      likes,
      posts,
      ...(paused === undefined
        ? {}
        : { pausedUntil: paused ? new Date(Date.now() + SOCIAL.backoffHours * 3_600_000) : null }),
    },
    zone,
  )
  if (!row) return fail(`Connect your ${platform === "x" ? "X" : "Instagram"} first`, 409)
  if ((autopilot === true && row.autopilot) || (likes === true && row.likes))
    await enqueue(
      "socialRun",
      { userId: me, platform, day: dayIn(zone ?? row.tz) },
      `${me}:${platform}`,
    )
  return json({ connection: viewOf(row) })
}

/** Forgets the account and its session. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const platform = platformOf((await params).platform)
  if (!platform) return fail("Not a platform Najimi connects", 404)
  await disconnect(auth.session.user.id, platform)
  return json({ ok: true })
}
