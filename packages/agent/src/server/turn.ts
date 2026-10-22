import { createHash } from "node:crypto"
import { AGENT, ALLOWANCE, MEDIA, ROOMS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { env } from "@najimi/env/server"
import { enqueue } from "@najimi/jobs"
import {
  convertToModelMessages,
  createIdGenerator,
  isStepCount,
  readUIMessageStream,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai"
import { and, asc, desc, eq } from "drizzle-orm"
import { contextBlock, RULES } from "../instructions"
import { agentModel, brainModelId, costOf } from "../models"
import { toolDefs } from "../tools"
import type { ChatMeta, NajimiUIMessage } from "../ui-message"
import { forModel } from "./files"
import { allMessages, saveAndPublish, setRoomStatus } from "./room"
import { buildTools } from "./tools"
import { usageToday } from "./usage"

/*
 * One turn of Najimi in a room, run by the worker (never inside a page's request), so everyone in
 * the room sees it stream, it finishes if they all leave, and the agent can also speak first (a
 * follow-up, a daily drop). The answer is one message row, saved and sent to the room as it grows
 * (a few times a second); a card that needs someone (an approval, a question) leaves it waiting,
 * and their answer resumes it.
 */

const nextId = createIdGenerator({ prefix: "msg", size: 16 })

/** Approvals are signed so nobody can forge "approved"; one secret on every instance. */
export const approvalSecret = () =>
  env.TOOL_APPROVAL_SECRET ??
  createHash("sha256").update(`approvals:${env.BETTER_AUTH_SECRET}`).digest("hex")

/** A message whose cards still need an answer from someone. */
const waitsOnSomeone = (m: NajimiUIMessage | null) =>
  Boolean(
    m?.parts.some(
      (p) =>
        (p.type === "tool-askUser" && p.state === "input-available") ||
        ("state" in p && p.state === "approval-requested"),
    ),
  )

export async function runTurn(chatId: string): Promise<void> {
  const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId))
  if (!chat) return
  const stored = await allMessages(chatId)
  const last = stored.at(-1)
  if (!last) return
  // A new message to answer, or an answered card to carry on from; otherwise nothing to do.
  const resuming = last.role === "assistant" && last.metadata?.status === "resume"
  if (last.role === "assistant" && !resuming) return

  // Who spoke last is who the turn acts for (their taste, their allowance, their approvals).
  const lastHuman = [...stored].reverse().find((m) => m.role === "user")
  const by = lastHuman?.metadata?.authorId ?? chat.ownerId
  const [[person], [author]] = await Promise.all([
    db
      .select()
      .from(schema.people)
      .where(and(eq(schema.people.ownerId, by), eq(schema.people.isSelf, true))),
    db
      .select({ isAnonymous: schema.user.isAnonymous })
      .from(schema.user)
      .where(eq(schema.user.id, by)),
  ])
  if (!person) return
  const guest = Boolean(author?.isAnonymous)

  const validated = await safeValidateUIMessages<NajimiUIMessage>({
    messages: stored,
    tools: toolDefs,
  })
  if (!validated.success) {
    console.error("[turn] unreadable room", chatId, validated.error)
    return
  }
  const messages = validated.data

  const modelId = brainModelId()
  const assistantId = resuming ? last.id : nextId()
  const startedAt = Date.now()
  if (!resuming)
    await db.insert(schema.messages).values({
      id: assistantId,
      chatId,
      role: "assistant",
      parts: [],
      status: "streaming",
      metadata: { createdAt: startedAt, model: modelId },
    })
  await setRoomStatus(chatId, "generating")

  const [loves, [taste]] = await Promise.all([
    db
      .select()
      .from(schema.loves)
      .where(eq(schema.loves.personId, person.id))
      .orderBy(asc(schema.loves.createdAt)),
    db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
  ])
  const made = await db
    .select({
      id: schema.creations.id,
      kind: schema.creations.kind,
      title: schema.creations.title,
      status: schema.creations.status,
    })
    .from(schema.creations)
    .where(eq(schema.creations.chatId, chatId))
  const photos = [
    ...new Set(
      messages
        .filter((m) => m.role === "user")
        .flatMap((m) =>
          m.parts.flatMap((p) =>
            p.type === "file" ? [/upload\/([0-9a-f-]{36})/.exec(p.url)?.[1] ?? ""] : [],
          ),
        )
        .filter(Boolean),
    ),
  ]
  const today = await usageToday(by)
  const left = (counter: "images") =>
    (guest ? ALLOWANCE.guest : ALLOWANCE.member)[counter] - today[counter]
  /** Ask mode: an approval card with the cost; Plan only: never; Make automatically: straight away. */
  const approval = (counter: "images", n: number) =>
    chat.mode === "plan"
      ? ({ type: "denied", reason: "plan" } as const)
      : chat.mode === "auto"
        ? ("not-applicable" as const)
        : ({
            type: "user-approval",
            reason: `${counter}:${n}:${Math.max(left(counter), 0)}`,
          } as const)

  // A circle or DM: who's in it, with a few of each one's loves.
  let room: Parameters<typeof contextBlock>[0]["room"] = null
  if (chat.kind !== "agent") {
    const members = await db
      .select({ name: schema.people.name, city: schema.people.city, personId: schema.people.id })
      .from(schema.chatMembers)
      .innerJoin(
        schema.people,
        and(eq(schema.people.ownerId, schema.chatMembers.userId), eq(schema.people.isSelf, true)),
      )
      .where(eq(schema.chatMembers.chatId, chatId))
    const memberLoves = await Promise.all(
      members.map((m) =>
        db
          .select({ name: schema.loves.name })
          .from(schema.loves)
          .where(eq(schema.loves.personId, m.personId))
          .orderBy(desc(schema.loves.weight))
          .limit(5),
      ),
    )
    room = {
      kind: chat.kind,
      name: chat.name,
      members: members.map((m, i) => ({
        name: m.name,
        city: m.city,
        loves: (memberLoves[i] ?? []).map((l) => l.name),
      })),
    }
  }
  const tools = buildTools({ userId: by, guest, chatId, person }, () => assistantId)
  const abort = new AbortController()
  // Stop: someone asked Najimi to stop; checked while it answers.
  const stopWatch = setInterval(async () => {
    const [now] = await db
      .select({ status: schema.chats.status })
      .from(schema.chats)
      .where(eq(schema.chats.id, chatId))
    if (now?.status === "stopping") abort.abort()
  }, ROOMS.stopCheckMs)

  let latest: NajimiUIMessage | null = resuming ? last : null
  let failure: string | null = null
  try {
    const result = streamText({
      model: agentModel(modelId),
      instructions: `${RULES}\n\n${contextBlock({
        locale: chat.locale,
        today: new Date().toISOString().slice(0, 10),
        mode: chat.mode,
        person: {
          id: person.id,
          name: person.name,
          city: person.city,
          loves: loves.map((l) => ({ name: l.name, type: l.type, weight: l.weight })),
          words: taste?.words ?? null,
        },
        screen: lastHuman?.metadata?.screen ?? null,
        room,
        photos,
        creations: made,
      })}`,
      // Room notices ("Juno joined") are for people, not the model (it takes no system messages).
      messages: await convertToModelMessages(
        await forModel(
          by,
          messages.filter((m) => m.role !== "system"),
        ),
        {
          tools,
          ignoreIncompleteToolCalls: true,
        },
      ),
      tools,
      abortSignal: abort.signal,
      experimental_toolApprovalSecret: approvalSecret(),
      toolApproval: {
        makeImage: (input) => approval("images", input.variants ?? MEDIA.image.variants),
      },
      stopWhen: isStepCount(AGENT.maxSteps),
      maxOutputTokens: AGENT.maxOutputTokens,
      providerOptions: {
        openai: { reasoningEffort: "low", textVerbosity: "low", promptCacheKey: "najimi-room-v1" },
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
            userId: by,
            chatId,
            messageId: assistantId,
            purpose: "room",
            provider: modelId.split(":")[0],
            model: modelId,
            inputTokens: usage.inputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            cacheReadTokens: usage.inputTokenDetails?.cacheReadTokens ?? null,
            cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? null,
            toolCalls: event.steps.reduce((n, s) => n + s.toolCalls.length, 0),
            ms: Date.now() - startedAt,
            stopReason: event.finishReason,
            costUsd: costOf(modelId, {
              input: usage.inputTokens,
              output: usage.outputTokens,
              cached: usage.inputTokenDetails?.cacheReadTokens,
            }),
          })
          .catch(() => undefined)
      },
    })

    const stream = toUIMessageStream<typeof tools, NajimiUIMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: () => assistantId,
      messageMetadata: ({ part }) =>
        part.type === "start"
          ? ({ createdAt: startedAt, model: modelId } satisfies ChatMeta)
          : part.type === "finish"
            ? ({ finishedAt: Date.now() } satisfies ChatMeta)
            : undefined,
      onError: (error) => {
        console.error("[turn]", error)
        const body = (error as { responseBody?: string }).responseBody ?? ""
        failure = /insufficient_quota|credit_balance|credit balance/i.test(
          `${body} ${(error as Error).message}`,
        )
          ? "out-of-credit"
          : "Something went wrong on our side. Try again."
        return failure
      },
    })

    let flushedAt = 0
    for await (const message of readUIMessageStream<NajimiUIMessage>({
      stream,
      ...(resuming ? { message: last } : {}),
    })) {
      latest = message
      if (Date.now() - flushedAt >= ROOMS.flushMs) {
        flushedAt = Date.now()
        await saveAndPublish(chatId, message, "streaming")
      }
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      console.error("[turn] failed", chatId, error)
      failure = "Something went wrong on our side. Try again."
    }
  } finally {
    clearInterval(stopWatch)
  }

  const answer: NajimiUIMessage = latest ?? {
    id: assistantId,
    role: "assistant",
    parts: [],
    metadata: { createdAt: startedAt, model: modelId },
  }
  const waiting = waitsOnSomeone(answer)
  await saveAndPublish(
    chatId,
    { ...answer, metadata: { ...answer.metadata, ...(failure ? { error: failure } : {}) } },
    failure && !answer.parts.length ? "failed" : waiting ? "waiting" : "done",
  )
  await setRoomStatus(chatId, waiting ? "waiting" : "idle")
  if (!chat.title && chat.kind === "agent")
    await enqueue("chatTitle", { chatId }).catch(() => undefined)
}
