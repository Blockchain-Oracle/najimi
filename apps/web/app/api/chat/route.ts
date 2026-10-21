import { createHash } from "node:crypto"
import {
  agentModel,
  agentModelId,
  contextBlock,
  type NajimiUIMessage,
  RULES,
  toolDefs,
} from "@najimi/agent"
import { AGENT, ALLOWANCE, DEFAULT_LOCALE, MEDIA } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { enqueue } from "@najimi/jobs"
import { videoReady } from "@najimi/media"
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"
import { fail, withSession } from "@/lib/api"
import { forModel, ownsUploads } from "@/lib/chat/files"
import { mergeIncoming, truncateForRegenerate, uploadIdsOf } from "@/lib/chat/merge"
import { chatExists, messagesOf, ownedChat, saveMessages } from "@/lib/chat/store"
import { buildTools } from "@/lib/chat/tools.server"
import { charge, usageToday } from "@/lib/chat/usage"
import { isLocale } from "@/lib/i18n"
import { ownedPerson, peopleOf, selfOf } from "@/lib/people"
import { isBuiltIn, runnableWorkflow } from "@/lib/workflows"

const nextId = createIdGenerator({ prefix: "msg", size: 16 })

const bodySchema = z.object({
  id: z.uuid(),
  message: z.object({
    id: z.string().min(1).max(100),
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.record(z.string(), z.unknown())).max(50),
    metadata: z.unknown().optional(),
  }),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
  messageId: z.string().max(100).optional(),
  /** Who a new chat is for (later turns use the chat's own). */
  personId: z.uuid().optional(),
  /** A workflow a new chat runs: a built-in, a public one, or the person's own. */
  workflow: z.string().max(60).optional(),
})

/** Approvals are signed so a client can't forge "approved"; one secret on every instance. */
const approvalSecret = () =>
  env.TOOL_APPROVAL_SECRET ??
  createHash("sha256").update(`approvals:${env.BETTER_AUTH_SECRET}`).digest("hex")

const localeFrom = (request: Request) => {
  const match = /(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/.exec(request.headers.get("cookie") ?? "")
  return match?.[1] && isLocale(match[1]) ? match[1] : DEFAULT_LOCALE
}

/**
 * One chat turn (C2). The client sends only its newest message; the conversation lives here.
 * The turn streams to the page, keeps running if the page goes away (consumeStream), and is saved
 * after every step, so a reload shows it and a restart mid-turn shows Retry.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const user = auth.session.user
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail("That doesn't look right", 400)
  const { id: chatId, trigger, messageId } = parsed.data
  const incoming = parsed.data.message as unknown as NajimiUIMessage

  // The chat, or a new one for the chosen person.
  let chat = await ownedChat(user.id, chatId)
  if (!chat) {
    if (await chatExists(chatId)) return fail("Unknown chat", 404)
    const person =
      (parsed.data.personId && (await ownedPerson(user.id, parsed.data.personId))) ||
      (await selfOf(user.id))
    if (!person) return fail("Tell Najimi who you are first", 409)
    const [prefs] = await db
      .select()
      .from(schema.userPrefs)
      .where(eq(schema.userPrefs.userId, user.id))
    const workflow = parsed.data.workflow
      ? await runnableWorkflow(user.id, parsed.data.workflow)
      : null
    if (workflow)
      await db
        .update(schema.workflows)
        .set({ runsCount: sql`${schema.workflows.runsCount} + 1` })
        .where(eq(schema.workflows.id, workflow.id))
    const [created] = await db
      .insert(schema.chats)
      .values({
        id: chatId,
        ownerId: user.id,
        personId: person.id,
        locale: localeFrom(request),
        mode: prefs?.mode ?? "ask",
        workflowId: workflow?.id ?? null,
      })
      .returning()
    if (!created) return fail("Couldn't start the chat", 500)
    chat = created
  }

  let stored = messagesOf(chat)
  if (trigger === "regenerate-message" && messageId)
    stored = truncateForRegenerate(stored, messageId) ?? stored
  const merged = mergeIncoming(stored, incoming)
  if (!merged) return fail("That message can't be continued", 409)
  if (!(await ownsUploads(user.id, uploadIdsOf(incoming)))) return fail("Unknown photo", 404)

  const validated = await safeValidateUIMessages<NajimiUIMessage>({
    messages: merged,
    tools: toolDefs,
  })
  if (!validated.success) return fail("This chat couldn't be read", 422)
  const messages = validated.data

  const isNewTurn = incoming.role === "user"
  const guest = Boolean((user as { isAnonymous?: boolean | null }).isAnonymous)
  if (isNewTurn && !(await charge(user.id, guest, "turns")))
    return fail("That's all the chat for today. Come back tomorrow, or sign in for more.", 429)

  const people = await peopleOf(user.id)
  const person = people.find((p) => p.id === chat.personId) ?? people.find((p) => p.isSelf)
  if (!person) return fail("Tell Najimi who you are first", 409)
  const [loves, [taste]] = await Promise.all([
    db.select().from(schema.loves).where(eq(schema.loves.personId, person.id)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
  ])

  const last = messages.at(-1)
  const assistantId = last?.role === "assistant" ? last.id : nextId()
  const tools = buildTools(
    { userId: user.id, guest, chatId: chat.id, person, people },
    () => assistantId,
  )
  // A built-in workflow's recipe joins the instructions; one someone saved is their own words and
  // goes in as their first message (the page sends it), never as instructions.
  const [workflowRow] = chat.workflowId
    ? await db.select().from(schema.workflows).where(eq(schema.workflows.id, chat.workflowId))
    : []
  const made = await db
    .select({
      id: schema.creations.id,
      kind: schema.creations.kind,
      title: schema.creations.title,
      status: schema.creations.status,
    })
    .from(schema.creations)
    .where(eq(schema.creations.chatId, chat.id))
  const photos = [...new Set(messages.filter((m) => m.role === "user").flatMap(uploadIdsOf))]
  const today = await usageToday(user.id)
  const left = (counter: "images" | "videos") =>
    (guest ? ALLOWANCE.guest : ALLOWANCE.member)[counter] - today[counter]
  /** Ask mode: an approval card with the cost; Plan only: never; Make automatically: straight away. */
  const approval = (counter: "images" | "videos", n: number) =>
    chat.mode === "plan"
      ? ({ type: "denied", reason: "plan" } as const)
      : chat.mode === "auto"
        ? ("not-applicable" as const)
        : ({
            type: "user-approval",
            reason: `${counter}:${n}:${Math.max(left(counter), 0)}`,
          } as const)
  const modelId = agentModelId()

  await saveMessages(chat.id, messages, "generating")
  await db
    .update(schema.chats)
    .set({ turnStartedAt: new Date() })
    .where(eq(schema.chats.id, chat.id))

  const startedAt = Date.now()
  const result = streamText({
    model: agentModel(modelId),
    instructions: `${RULES}\n\n${contextBlock({
      speaker: people.find((p) => p.isSelf)?.name ?? person.name,
      locale: chat.locale,
      today: new Date().toISOString().slice(0, 10),
      mode: chat.mode,
      person: {
        id: person.id,
        name: person.name,
        city: person.city,
        ageBand: person.ageBand,
        constraints: person.constraints,
        loves: loves.map((l) => ({ name: l.name, type: l.type, weight: l.weight })),
        words: taste?.words ?? null,
      },
      others: people.filter((p) => p.id !== person.id).map((p) => ({ id: p.id, name: p.name })),
      photos,
      creations: made,
      workflow: workflowRow && isBuiltIn(workflowRow) ? workflowRow.instructions : null,
      videoReady: videoReady(),
    })}`,
    messages: await convertToModelMessages(await forModel(user.id, messages), {
      tools,
      ignoreIncompleteToolCalls: true,
    }),
    tools,
    experimental_toolApprovalSecret: approvalSecret(),
    toolApproval: {
      makeImage: (input) => approval("images", input.variants ?? MEDIA.image.variants),
      makeVideo: () => approval("videos", 1),
    },
    stopWhen: isStepCount(AGENT.maxSteps),
    maxOutputTokens: AGENT.maxOutputTokens,
    providerOptions: {
      openai: { reasoningEffort: "low", textVerbosity: "low", promptCacheKey: "najimi-chat-v1" },
      anthropic: { effort: "medium" },
    },
    onEnd: async (event) => {
      const usage = event.usage as {
        inputTokens?: number
        outputTokens?: number
        inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number }
      }
      await db
        .insert(schema.llmCalls)
        .values({
          userId: user.id,
          chatId: chat.id,
          messageId: assistantId,
          purpose: "chat",
          provider: modelId.split(":")[0],
          model: modelId,
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
          cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? null,
          cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? null,
          toolCalls: event.steps.reduce((n, s) => n + s.toolCalls.length, 0),
          ms: Date.now() - startedAt,
          stopReason: event.finishReason,
        })
        .catch(() => undefined)
    },
  })
  // The turn runs to the end even if the page closes: no abort signal, and the stream is drained.
  result.consumeStream()

  return createUIMessageStreamResponse({
    keepAliveMs: AGENT.keepAliveMs,
    headers: { "cache-control": "no-cache, no-transform" },
    stream: toUIMessageStream<typeof tools, NajimiUIMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: () => assistantId,
      messageMetadata: ({ part }) =>
        part.type === "start" ? { createdAt: Date.now(), model: modelId } : undefined,
      onStepEnd: ({ messages: all }) => saveMessages(chat.id, all),
      onEnd: async ({ messages: all }) => {
        // A question card left open means the chat is waiting on the person.
        const waiting = all
          .at(-1)
          ?.parts.some((p) => p.type === "tool-askUser" && p.state === "input-available")
        await saveMessages(chat.id, all, waiting ? "waiting" : "idle")
        if (!chat.title) await enqueue("chatTitle", { chatId: chat.id }).catch(() => undefined)
      },
      onError: (error) => {
        console.error("[chat]", error)
        const body = (error as { responseBody?: string }).responseBody ?? ""
        if (
          /insufficient_quota|credit_balance|credit balance/i.test(
            `${body} ${(error as Error).message}`,
          )
        )
          return "out-of-credit"
        return "Something went wrong on our side. Try again."
      },
    }),
  })
}
