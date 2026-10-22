import { db, schema } from "@najimi/db"
import type { GameItem, GameKind } from "@najimi/db/schema"
import type { CallContext } from "@najimi/qloo"
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm"
import { buildRound } from "./build"
import { najimiPlays, type PublicItem, publicItems, scoreOf } from "./index"

/*
 * A round's life: built from Qloo, played one item at a time (each answer is kept the moment it's
 * given, then that item's truth is shown beside your guess and Najimi's, so nobody can peek), and
 * ranked. Players are people, or guests from a challenge link (a key kept in their browser).
 */

export type Player = { userId: string } | { guestKey: string; guestName?: string }

const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14)

export const TITLES: Record<GameKind, string> = {
  wavelength: "Guess my wavelength",
  knowme: "How well do you know me",
  twins: "Taste twins",
  blind: "Blind Taste",
}

export async function createRound(
  input: {
    kind: GameKind
    createdBy: string
    subjectId?: string | null
    chatId?: string | null
    daily?: boolean
  },
  ctx: CallContext,
) {
  const items = await buildRound(
    input.kind,
    { subjectId: input.subjectId, playerId: input.createdBy, chatId: input.chatId },
    { ...ctx, userId: input.createdBy, purpose: `${TITLES[input.kind]}: building the round` },
  )
  if (!items.length) throw new Error("Not enough taste here for a round yet")
  const id = crypto.randomUUID()
  const answers = najimiPlays(input.kind, items, id)
  const [round] = await db
    .insert(schema.gameRounds)
    .values({
      id,
      kind: input.kind,
      chatId: input.chatId ?? null,
      subjectId: input.kind === "blind" ? input.createdBy : (input.subjectId ?? input.createdBy),
      createdBy: input.createdBy,
      items,
      token: token(),
      daily: input.daily ?? false,
      najimi: { answers, score: scoreOf(input.kind, items, answers).score },
    })
    .returning()
  if (!round) throw new Error("Couldn't start the game")
  return round
}

async function subjectCard(userId: string | null) {
  if (!userId) return null
  const [row] = await db
    .select({
      name: schema.people.name,
      look: schema.people.look,
      aura: schema.people.aura,
      username: schema.user.displayUsername,
    })
    .from(schema.people)
    .innerJoin(schema.user, eq(schema.user.id, schema.people.ownerId))
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  return row ?? null
}

async function answersOf(roundId: string, player: Player) {
  const [row] = await db
    .select()
    .from(schema.gameAnswers)
    .where(
      and(
        eq(schema.gameAnswers.roundId, roundId),
        "userId" in player
          ? eq(schema.gameAnswers.playerId, player.userId)
          : eq(schema.gameAnswers.guestKey, player.guestKey),
      ),
    )
  return row ?? null
}

export type Reveal = {
  index: number
  answer: number
  truth: number
  points: number
  najimi: number
  najimiPoints: number
}

function revealsOf(round: typeof schema.gameRounds.$inferSelect, answers: number[]): Reveal[] {
  const mine = scoreOf(round.kind, round.items, answers).perItem
  const theirs = round.najimi?.answers ?? []
  const najimiPoints = scoreOf(round.kind, round.items, theirs).perItem
  return answers.map((answer, index) => ({
    index,
    answer,
    truth: (round.items[index] as GameItem).truth,
    points: mine[index] ?? 0,
    najimi: theirs[index] ?? 0,
    najimiPoints: najimiPoints[index] ?? 0,
  }))
}

/** A round as a player sees it: the items (truths only for what they've answered), and who it's about. */
export async function roundView(roundToken: string, player: Player | null) {
  const [round] = await db
    .select()
    .from(schema.gameRounds)
    .where(eq(schema.gameRounds.token, roundToken))
  if (!round) return null
  const mine = player ? await answersOf(round.id, player) : null
  const answered = mine?.answers ?? []
  const me =
    player && "userId" in player
      ? await subjectCard(player.userId)
      : mine?.guestName
        ? { name: mine.guestName, look: null, aura: null, username: null }
        : null
  return {
    id: round.id,
    kind: round.kind,
    title: TITLES[round.kind],
    token: round.token,
    chatId: round.chatId,
    subject: await subjectCard(round.subjectId),
    /** The player is who the round is about (their own wavelength, their Blind Taste). */
    mine: Boolean(player && "userId" in player && player.userId === round.subjectId),
    /** Who's playing (null for a guest who hasn't answered yet). */
    me,
    signedIn: Boolean(player && "userId" in player),
    items: publicItems(round.items) as PublicItem[],
    reveals: revealsOf(round, answered),
    done: answered.length >= round.items.length,
    score: mine?.score ?? 0,
    najimiScore: answered.length >= round.items.length ? (round.najimi?.score ?? 0) : null,
  }
}

export type RoundView = NonNullable<Awaited<ReturnType<typeof roundView>>>

/**
 * One answer, in order: it's kept, then that item's truth comes back beside Najimi's answer. A
 * guest gives a name on their first answer.
 */
export async function answerItem(
  roundToken: string,
  player: Player,
  index: number,
  answer: number,
) {
  const [round] = await db
    .select()
    .from(schema.gameRounds)
    .where(eq(schema.gameRounds.token, roundToken))
  if (!round) return { error: "That game is gone" as const }
  // Blind Taste's truths are one person's: only they can play that round.
  if (round.kind === "blind" && !("userId" in player && player.userId === round.subjectId))
    return { error: "This Blind Taste was dealt for someone else" as const }
  const item = round.items[index]
  if (!item) return { error: "No such question" as const }
  const max =
    round.kind === "wavelength" ? 100 : round.kind === "blind" ? 2 : (item.options?.length ?? 1) - 1
  if (!Number.isInteger(answer) || answer < 0 || answer > max)
    return { error: "That isn't an answer" as const }
  const existing = await answersOf(round.id, player)
  const before = existing?.answers ?? []
  if (before.length !== index) return { error: "Answer the questions in order" as const }
  const answers = [...before, answer]
  const { score, right } = scoreOf(round.kind, round.items.slice(0, answers.length), answers)
  if (existing)
    await db
      .update(schema.gameAnswers)
      .set({ answers, score, right })
      .where(eq(schema.gameAnswers.id, existing.id))
  else
    await db.insert(schema.gameAnswers).values({
      roundId: round.id,
      ...("userId" in player
        ? { playerId: player.userId }
        : { guestKey: player.guestKey, guestName: player.guestName?.slice(0, 40) || "Guest" }),
      answers,
      score,
      right,
    })
  const reveals = revealsOf(round, answers)
  const done = answers.length >= round.items.length
  return {
    reveal: reveals[index] as Reveal,
    score,
    done,
    najimiScore: done ? (round.najimi?.score ?? 0) : null,
    chatId: round.chatId,
    roundId: round.id,
    kind: round.kind,
    title: TITLES[round.kind],
    subjectId: round.subjectId,
  }
}

export type BoardRow = {
  name: string
  look: string | null
  username: string | null
  score: number
  najimi?: boolean
  /** The player asking. */
  me?: boolean
}

/** Everyone who played a round, best first, with Najimi among them. */
export async function roundBoard(roundToken: string, player?: Player | null): Promise<BoardRow[]> {
  const [round] = await db
    .select()
    .from(schema.gameRounds)
    .where(eq(schema.gameRounds.token, roundToken))
  if (!round) return []
  const rows = await db
    .select({
      score: schema.gameAnswers.score,
      answers: schema.gameAnswers.answers,
      guestName: schema.gameAnswers.guestName,
      playerId: schema.gameAnswers.playerId,
      guestKey: schema.gameAnswers.guestKey,
      name: schema.people.name,
      look: schema.people.look,
      username: schema.user.displayUsername,
    })
    .from(schema.gameAnswers)
    .leftJoin(schema.user, eq(schema.user.id, schema.gameAnswers.playerId))
    .leftJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.gameAnswers.playerId), eq(schema.people.isSelf, true)),
    )
    .where(eq(schema.gameAnswers.roundId, round.id))
  const finished = rows.filter((r) => r.answers.length >= round.items.length)
  return [
    ...finished.map((r) => ({
      name: r.name ?? r.guestName ?? "Guest",
      look: r.look,
      username: r.username,
      score: r.score,
      me: Boolean(
        player &&
          ("userId" in player ? r.playerId === player.userId : r.guestKey === player.guestKey),
      ),
    })),
    { name: "Najimi", look: null, username: null, score: round.najimi?.score ?? 0, najimi: true },
  ].sort((a, b) => b.score - a.score)
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** This week's leaderboard: points from finished rounds, in one circle or everywhere. */
export async function weeklyBoard(chatId?: string | null, limit = 20) {
  const since = new Date(Date.now() - WEEK_MS)
  const rows = await db
    .select({
      userId: schema.gameAnswers.playerId,
      name: schema.people.name,
      look: schema.people.look,
      aura: schema.people.aura,
      username: schema.user.displayUsername,
      points: sql<number>`sum(${schema.gameAnswers.score})::int`,
      games: sql<number>`count(*)::int`,
    })
    .from(schema.gameAnswers)
    .innerJoin(schema.gameRounds, eq(schema.gameRounds.id, schema.gameAnswers.roundId))
    .innerJoin(schema.user, eq(schema.user.id, schema.gameAnswers.playerId))
    .innerJoin(
      schema.people,
      and(eq(schema.people.ownerId, schema.gameAnswers.playerId), eq(schema.people.isSelf, true)),
    )
    .where(
      and(
        gte(schema.gameAnswers.createdAt, since),
        isNotNull(schema.gameAnswers.playerId),
        chatId ? eq(schema.gameRounds.chatId, chatId) : sql`${schema.people.visibility} = 'public'`,
      ),
    )
    .groupBy(
      schema.gameAnswers.playerId,
      schema.people.name,
      schema.people.look,
      schema.people.aura,
      schema.user.displayUsername,
    )
    .orderBy(desc(sql`sum(${schema.gameAnswers.score})`))
    .limit(limit)
  return rows
}

/** "Qloo was right about you": how often Blind Taste's predictions matched how you felt. */
export async function qlooRightAbout(userId: string) {
  const [row] = await db
    .select({
      right: sql<number>`coalesce(sum(${schema.gameAnswers.right}), 0)::int`,
      total: sql<number>`coalesce(sum(jsonb_array_length(${schema.gameAnswers.answers})), 0)::int`,
    })
    .from(schema.gameAnswers)
    .innerJoin(schema.gameRounds, eq(schema.gameRounds.id, schema.gameAnswers.roundId))
    .where(and(eq(schema.gameAnswers.playerId, userId), eq(schema.gameRounds.kind, "blind")))
  const total = Number(row?.total ?? 0)
  return total ? { percent: Math.round((Number(row?.right ?? 0) / total) * 100), total } : null
}

/** Days in a row someone has played their circles' daily drop (today or yesterday keeps it alive). */
export async function streakOf(userId: string): Promise<number> {
  const rows = await db.execute<{ day: string }>(sql`
    select distinct (a.created_at at time zone 'utc')::date as day
    from ${schema.gameAnswers} a join ${schema.gameRounds} r on r.id = a.round_id
    where a.player_id = ${userId} and r.daily
    order by day desc limit 60`)
  const days = rows.map((r) => String(r.day).slice(0, 10))
  let streak = 0
  const cursor = new Date()
  cursor.setUTCHours(0, 0, 0, 0)
  if (days[0] !== cursor.toISOString().slice(0, 10)) cursor.setUTCDate(cursor.getUTCDate() - 1)
  for (const day of days) {
    if (day !== cursor.toISOString().slice(0, 10)) break
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}
