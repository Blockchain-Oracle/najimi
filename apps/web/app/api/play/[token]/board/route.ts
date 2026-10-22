import { roundBoard } from "@najimi/games/round"
import { json } from "@/lib/api"
import { currentPlayer } from "@/lib/game-player"

/** Everyone who finished this round, best first, Najimi among them (your row marked). */
export async function GET(_: Request, ctx: RouteContext<"/api/play/[token]/board">) {
  return json({ board: await roundBoard((await ctx.params).token, await currentPlayer()) })
}
