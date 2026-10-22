import { postGameCard } from "@najimi/agent/server"
import { GAMES } from "@najimi/config"
import { createRound, TITLES } from "@najimi/games/round"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"
import { selfOf } from "@/lib/people"
import { allow } from "@/lib/rate-limit"
import { profileByUsername } from "@/lib/social"

const input = z.object({
  kind: z.enum(["wavelength", "knowme", "twins", "blind"]),
  chatId: z.uuid().optional(),
  /** Whose taste (by @username); default: yours. */
  about: z.string().max(40).optional(),
})

/**
 * Starts a game. In a circle its card goes into the room for everyone; otherwise you get its
 * challenge link to play and share.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  if (!allow(`games:${me}`, GAMES.perMinute, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const { kind, chatId, about } = parsed.data
  const self = await selfOf(me)
  if (!self) return fail("Pick a few loves first", 409)
  if (chatId && !(await ownedChat(me, chatId))) return fail("Unknown room", 404)
  let subjectId = me
  let subject = { name: self.name, look: self.look }
  if (about && kind !== "blind" && kind !== "twins") {
    const profile = await profileByUsername(about.replace(/^@/, ""), me)
    if (!profile || profile.hidden) return fail("Unknown person", 404)
    subjectId = profile.row.person.ownerId
    subject = { name: profile.row.person.name, look: profile.row.person.look }
  }
  try {
    const round = await createRound(
      { kind, createdBy: me, subjectId, chatId: chatId ?? null },
      { chatId },
    )
    if (chatId)
      await postGameCard(chatId, {
        roundId: round.id,
        token: round.token,
        kind,
        title: TITLES[kind],
        count: round.items.length,
        subject,
        about,
        startedBy: me,
      })
    return json({ token: round.token }, 201)
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Couldn't start the game", 422)
  }
}
