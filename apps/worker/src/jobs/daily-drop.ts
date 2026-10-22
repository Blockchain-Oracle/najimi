import { postGameCard } from "@najimi/agent/server"
import { GAMES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { NAJIMI_USER } from "@najimi/games/lounge"
import { createRound, TITLES } from "@najimi/games/round"
import { publish, topic } from "@najimi/live"
import { and, eq, gte, sql } from "drizzle-orm"

/*
 * The daily drop (W9): every morning Najimi deals a "Guess my wavelength" round into each circle
 * someone spoke in this week, about one of its members (a different one most days), and tells
 * everyone in it. Playing it keeps your streak alive.
 */

const MIN_LOVES = 3

export async function dailyDrop() {
  const since = new Date(Date.now() - GAMES.activeDays * 24 * 60 * 60 * 1000)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const circles = await db
    .select({ id: schema.chats.id, name: schema.chats.name })
    .from(schema.chats)
    .where(and(eq(schema.chats.kind, "circle"), gte(schema.chats.lastActiveAt, since)))
  let dealt = 0
  for (const circle of circles) {
    const [already] = await db
      .select({ id: schema.gameRounds.id })
      .from(schema.gameRounds)
      .where(
        and(
          eq(schema.gameRounds.chatId, circle.id),
          eq(schema.gameRounds.daily, true),
          gte(schema.gameRounds.createdAt, today),
        ),
      )
    if (already) continue
    // Members with enough taste to be guessed, least recently the subject first.
    const members = await db.execute<{ user_id: string; name: string; look: string | null }>(sql`
      select m.user_id, p.name, p.look
      from ${schema.chatMembers} m
      join ${schema.people} p on p.owner_id = m.user_id and p.is_self
      where m.chat_id = ${circle.id}
        and (select count(*) from ${schema.loves} l where l.person_id = p.id) >= ${MIN_LOVES}
      order by (
        select max(r.created_at) from ${schema.gameRounds} r
        where r.chat_id = ${circle.id} and r.daily and r.subject_id = m.user_id
      ) asc nulls first, random()
      limit 1`)
    const subject = members[0]
    if (!subject) continue
    try {
      const round = await createRound(
        {
          kind: "wavelength",
          createdBy: NAJIMI_USER.id,
          subjectId: subject.user_id,
          chatId: circle.id,
          daily: true,
        },
        { chatId: circle.id },
      )
      await postGameCard(circle.id, {
        roundId: round.id,
        token: round.token,
        kind: "wavelength",
        title: TITLES.wavelength,
        count: round.items.length,
        subject: { name: subject.name, look: subject.look },
        note: "Today's drop",
        startedBy: NAJIMI_USER.id,
        bump: false,
      })
      const everyone = await db
        .select({ userId: schema.chatMembers.userId })
        .from(schema.chatMembers)
        .where(eq(schema.chatMembers.chatId, circle.id))
      const people = everyone.filter((m) => m.userId !== NAJIMI_USER.id)
      if (people.length) {
        const rows = await db
          .insert(schema.notifications)
          .values(
            people.map((m) => ({
              userId: m.userId,
              kind: "drop" as const,
              chatId: circle.id,
              data: { name: circle.name ?? "your circle", token: round.token },
            })),
          )
          .returning({ id: schema.notifications.id, userId: schema.notifications.userId })
        await Promise.all(
          rows.map((r) =>
            publish(topic.user(r.userId), "notification", { id: r.id, kind: "drop" }),
          ),
        )
      }
      dealt++
    } catch (error) {
      console.error("[daily-drop]", circle.id, (error as Error).message)
    }
  }
  console.log(`[daily-drop] dealt ${dealt} of ${circles.length} circles`)
}
