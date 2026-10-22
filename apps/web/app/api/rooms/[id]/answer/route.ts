import { askUserOutput, type NajimiUIMessage } from "@najimi/agent"
import { saveAndPublish, toUI } from "@najimi/agent/server"
import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { and, desc, eq, lte } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"
import { outcomeOf, saveOutcome } from "@/lib/outcomes"

const input = z.union([
  z.object({
    messageId: z.string().max(100),
    approval: z.object({
      id: z.string().max(200),
      approved: z.boolean(),
      reason: z.string().max(300).optional(),
    }),
  }),
  z.object({
    messageId: z.string().max(100),
    answer: z.object({ toolCallId: z.string().max(200), output: askUserOutput }),
  }),
])

type Part = NajimiUIMessage["parts"][number] & {
  state?: string
  toolCallId?: string
  approval?: { id: string } & Record<string, unknown>
}

/**
 * Someone answers a card Najimi left waiting: an approval (make it, or don't) or a question card.
 * Once nothing on the message waits any more, Najimi carries on from where it stopped.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/rooms/[id]/answer">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown room", 404)
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  const data = parsed.data

  const [row] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.id, data.messageId), eq(schema.messages.chatId, chat.id)))
  if (row?.role !== "assistant" || row.status !== "waiting")
    return fail("That card was already answered", 409)

  // An approval (a call, a post, a picture) is the yes of the person who asked for it: the author
  // of the last message before Najimi's turn. Anyone in the room may answer a question card.
  if ("approval" in data && chat.kind !== "agent") {
    const [asker] = await db
      .select({ authorId: schema.messages.authorId })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.chatId, chat.id),
          eq(schema.messages.role, "user"),
          lte(schema.messages.createdAt, row.createdAt),
        ),
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(1)
    if (asker?.authorId && asker.authorId !== auth.session.user.id)
      return fail("Only the person who asked can say yes to this", 403)
  }

  let found = false
  const parts = (row.parts as Part[]).map((p) => {
    if (
      "approval" in data &&
      p.state === "approval-requested" &&
      p.approval?.id === data.approval.id
    ) {
      found = true
      return {
        ...p,
        state: "approval-responded",
        approval: { ...p.approval, approved: data.approval.approved, reason: data.approval.reason },
      }
    }
    if (
      "answer" in data &&
      p.type === "tool-askUser" &&
      p.state === "input-available" &&
      p.toolCallId === data.answer.toolCallId
    ) {
      found = true
      return { ...p, state: "output-available", output: data.answer.output }
    }
    return p
  })
  if (!found) return fail("That card was already answered", 409)

  const stillWaiting = parts.some(
    (p) =>
      p.state === "approval-requested" ||
      (p.type === "tool-askUser" && p.state === "input-available"),
  )
  // "How was it?" (a follow-up card): the answer is kept on the booking or night it was about.
  if ("answer" in data && data.answer.toolCallId.startsWith("follow_")) {
    const meta = (row.metadata ?? {}) as { bookingId?: string; planId?: string }
    const card = (row.parts as Part[]).find((p) => p.toolCallId === data.answer.toolCallId) as
      | (Part & { input?: { steps?: { options?: { id: string; label: string }[] }[] } })
      | undefined
    const outcome = outcomeOf(
      card?.input?.steps?.[0]?.options,
      data.answer.output.answers[0]?.choices[0],
    )
    if (outcome) await saveOutcome(auth.session.user.id, meta, outcome)
  }

  const message = toUI({ ...row, parts })
  await saveAndPublish(chat.id, message, stillWaiting ? "waiting" : "resume")
  if (!stillWaiting) await enqueue("agentTurn", { chatId: chat.id }, chat.id)
  return json({ ok: true })
}
