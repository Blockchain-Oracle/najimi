import { agentModel, costOf, lightModelId, type NajimiUIMessage } from "@najimi/agent"
import { allMessages } from "@najimi/agent/server"
import { AGENT, LOCALES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { publish, topic } from "@najimi/live"
import { generateText } from "ai"
import { eq } from "drizzle-orm"

const textOf = (m: NajimiUIMessage | undefined) =>
  (m?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .trim()
    .slice(0, 600)

/** A new chat's title in its own language, from its first exchange. */
export async function chatTitle(chatId: string): Promise<void> {
  const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, chatId))
  if (!chat || chat.title) return
  const messages: NajimiUIMessage[] = await allMessages(chatId)
  const ask = textOf(messages.find((m) => m.role === "user"))
  if (!ask) return
  const answer = textOf(messages.find((m) => m.role === "assistant"))
  const language = LOCALES.find((l) => l.code === chat.locale)?.name ?? "English"
  const started = Date.now()
  const result = await generateText({
    model: agentModel(lightModelId()),
    instructions: `Write a title of two to five words, in ${language}, for a chat that starts like this. Sentence case, no quotes, no full stop.`,
    prompt: `Person: ${ask}\nAssistant: ${answer}`,
    maxOutputTokens: 400,
    providerOptions: { openai: { reasoningEffort: "low" } },
  })
  const title = result.text
    .trim()
    .replace(/^["'«“]|["'»”.]$/g, "")
    .slice(0, AGENT.titleMax)
  if (title) {
    await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
    await publish(topic.room(chatId), "title", { title })
  }
  await db.insert(schema.llmCalls).values({
    userId: chat.ownerId,
    chatId,
    purpose: "title",
    provider: lightModelId().split(":")[0],
    model: lightModelId(),
    inputTokens: result.usage.inputTokens ?? null,
    outputTokens: result.usage.outputTokens ?? null,
    ms: Date.now() - started,
    costUsd: costOf(lightModelId(), {
      input: result.usage.inputTokens,
      output: result.usage.outputTokens,
    }),
  })
}
