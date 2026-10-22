import { DEFAULT_LOCALE } from "@najimi/config"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { dmWith } from "@/lib/chat/store"
import { selfOf } from "@/lib/people"
import { profileByUsername } from "@/lib/social"

const input = z.object({ username: z.string().min(1).max(40) })

/** A conversation with someone (the one you already have, or a new one). */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const me = auth.session.user.id
  if (!(await selfOf(me))) return fail("Pick a few loves first", 409)
  const profile = await profileByUsername(parsed.data.username, me)
  if (!profile || profile.hidden || profile.isSelf) return fail("Unknown person", 404)
  const chat = await dmWith(me, profile.row.person.ownerId, DEFAULT_LOCALE)
  return json({ chatId: chat.id })
}
