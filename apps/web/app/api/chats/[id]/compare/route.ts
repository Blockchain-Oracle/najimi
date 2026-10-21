import { agentModel, agentModelId, type NajimiUIMessage } from "@najimi/agent"
import { LOCALES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { generateText } from "ai"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { messagesOf, ownedChat, saveMessages } from "@/lib/chat/store"
import { allow } from "@/lib/rate-limit"

const textOf = (m: NajimiUIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim()

/**
 * Compare without taste (C13): the same ask answered by the same model with no taste profile, no
 * Qloo and no tools, so the difference on screen is exactly what Qloo adds. Kept on the message.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/chats/[id]/compare">) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const chat = await ownedChat(auth.session.user.id, (await ctx.params).id)
  if (!chat) return fail("Unknown chat", 404)
  const parsed = await body(request, z.object({ messageId: z.string().max(100) }))
  if ("error" in parsed) return parsed.error
  const messages = messagesOf(chat)
  const at = messages.findIndex((m) => m.id === parsed.data.messageId && m.role === "assistant")
  const answer = messages[at]
  if (!answer) return fail("Unknown message", 404)
  if (answer.metadata?.compare) return json(answer.metadata.compare)
  const ask = [...messages.slice(0, at)].reverse().find((m) => m.role === "user")
  if (!ask || !textOf(ask)) return fail("Nothing to compare", 400)
  if (!allow(`compare:${auth.session.user.id}`, 20, 60 * 60 * 1000))
    return fail("Slow down a little", 429)

  const language = LOCALES.find((l) => l.code === chat.locale)?.name ?? "English"
  const started = Date.now()
  const result = await generateText({
    model: agentModel(),
    instructions: `You are a helpful general-purpose assistant. Answer in ${language}, briefly and concretely.`,
    prompt: textOf(ask),
    maxOutputTokens: 2000,
    providerOptions: { openai: { reasoningEffort: "low", textVerbosity: "low" } },
  })
  const compare = { generic: result.text.trim(), at: Date.now() }
  const updated = messages.map((m, i) =>
    i === at ? { ...m, metadata: { ...m.metadata, compare } } : m,
  )
  await saveMessages(chat.id, updated)
  await db.insert(schema.llmCalls).values({
    userId: auth.session.user.id,
    chatId: chat.id,
    messageId: answer.id,
    purpose: "compare",
    provider: agentModelId().split(":")[0],
    model: agentModelId(),
    inputTokens: result.usage.inputTokens ?? null,
    outputTokens: result.usage.outputTokens ?? null,
    ms: Date.now() - started,
  })
  return json(compare)
}
