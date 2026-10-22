import { askUserOutput, type NajimiUIMessage } from "@najimi/agent"
import { saveAndPublish, toUI } from "@najimi/agent/server"
import { db, schema } from "@najimi/db"
import { enqueue } from "@najimi/jobs"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { ownedChat } from "@/lib/chat/store"

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
  const message = toUI({ ...row, parts })
  await saveAndPublish(chat.id, message, stillWaiting ? "waiting" : "resume")
  if (!stillWaiting) await enqueue("agentTurn", { chatId: chat.id }, chat.id)
  return json({ ok: true })
}
