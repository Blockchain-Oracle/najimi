import { db, schema } from "@najimi/db"
import { qlooRightAbout, streakOf, weeklyBoard } from "@najimi/games/round"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

/**
 * This week's leaderboard (a circle's, or everyone's), your streak, how right Qloo was about you,
 * and your loves' artwork (the game tiles wear it).
 */
export async function GET(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const me = auth.session.user.id
  const chatId = z.uuid().safeParse(new URL(request.url).searchParams.get("chatId")).data
  if (chatId && !(await ownedChat(me, chatId))) return fail("Unknown room", 404)
  const [board, streak, qloo, art] = await Promise.all([
    weeklyBoard(chatId ?? null),
    streakOf(me),
    qlooRightAbout(me),
    db
      .select({ image: schema.loves.imageUrl })
      .from(schema.loves)
      .innerJoin(schema.people, eq(schema.people.id, schema.loves.personId))
      .where(and(eq(schema.people.ownerId, me), eq(schema.people.isSelf, true)))
      .orderBy(desc(schema.loves.weight))
      .limit(8),
  ])
  return json({
    board,
    me,
    streak,
    qloo,
    art: art.flatMap((a) => (a.image ? [a.image] : [])),
  })
}
