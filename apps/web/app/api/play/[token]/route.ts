import { publishMessage, toUI } from "@najimi/agent/server"
import { db, schema } from "@najimi/db"
import { answerItem, roundView } from "@najimi/games/round"
import { publish, topic } from "@najimi/live"
import { z } from "zod"
import { body, fail, json } from "@/lib/api"
import { currentPlayer } from "@/lib/game-player"
import { selfOf } from "@/lib/people"
import { allow, clientAddress } from "@/lib/rate-limit"
import { notify } from "@/lib/social"

/** A round as you see it (no truths until you've answered). Anyone with the link may look. */
export async function GET(_: Request, ctx: RouteContext<"/api/play/[token]">) {
  const view = await roundView((await ctx.params).token, await currentPlayer())
  if (!view) return fail("That game is gone", 404)
  return json(view)
}

const input = z.object({
  index: z.number().int().min(0).max(20),
  answer: z.number().int().min(0).max(100),
  guestName: z.string().trim().max(40).optional(),
})

/**
 * One answer: kept, then that item's truth and Najimi's answer come back. A finished go is news:
 * the circle hears the score (and its scoreboard updates for everyone watching), and the person
 * the round is about hears who played their taste.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/play/[token]">) {
  if (!allow(`play:${clientAddress(request)}`, 120, 60_000)) return fail("Slow down a little", 429)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const player = await currentPlayer(true)
  if (!player) return fail("Couldn't tell who's playing", 400)
  const who = "guestKey" in player ? { ...player, guestName: parsed.data.guestName } : player
  const token = (await ctx.params).token
  const result = await answerItem(token, who, parsed.data.index, parsed.data.answer)
  if (result.error !== undefined) return fail(result.error, 409)
  if (result.done) {
    const self = "userId" in player ? await selfOf(player.userId) : null
    const name = self?.name ?? (parsed.data.guestName?.trim() || "A guest")
    const vs = `Najimi ${result.najimiScore ?? 0}`
    if (result.chatId) {
      const [row] = await db
        .insert(schema.messages)
        .values({
          id: `sys_game_${result.roundId.slice(0, 8)}_${Date.now().toString(36)}`,
          chatId: result.chatId,
          role: "system",
          parts: [
            { type: "text", text: `${name} scored ${result.score} on ${result.title} · ${vs}` },
          ],
        })
        .returning()
      if (row) await publishMessage(result.chatId, toUI(row))
      await publish(topic.room(result.chatId), "game", { roundId: result.roundId })
    }
    const playerId = "userId" in player ? player.userId : null
    if (result.subjectId && result.kind !== "blind" && result.subjectId !== playerId)
      await notify({
        userId: result.subjectId,
        kind: "played",
        actorId: playerId,
        chatId: result.chatId,
        data: { token, title: result.title, score: result.score, name },
      })
  }
  return json(result)
}
