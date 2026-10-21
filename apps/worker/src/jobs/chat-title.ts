import { agentModel, agentModelId, type NajimiUIMessage } from "@najimi/agent"
import { AGENT, LOCALES } from "@najimi/config"
import { db, schema } from "@najimi/db"
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
  const messages = chat.messages as NajimiUIMessage[]
  const ask = textOf(messages.find((m) => m.role === "user"))
  if (!ask) return
  const answer = textOf(messages.find((m) => m.role === "assistant"))
  const language = LOCALES.find((l) => l.code === chat.locale)?.name ?? "English"
  const started = Date.now()
  const result = await generateText({
    model: agentModel(),
    instructions: `Write a title of two to five words, in ${language}, for a chat that starts like this. Sentence case, no quotes, no full stop.`,
    prompt: `Person: ${ask}\nAssistant: ${answer}`,
    maxOutputTokens: 400,
    providerOptions: { openai: { reasoningEffort: "low" } },
  })
  const title = result.text
    .trim()
    .replace(/^["'«“]|["'»”.]$/g, "")
    .slice(0, AGENT.titleMax)
  if (title) await db.update(schema.chats).set({ title }).where(eq(schema.chats.id, chatId))
  await db.insert(schema.llmCalls).values({
    userId: chat.ownerId,
    chatId,
    purpose: "title",
    provider: agentModelId().split(":")[0],
    model: agentModelId(),
    inputTokens: result.usage.inputTokens ?? null,
    outputTokens: result.usage.outputTokens ?? null,
    ms: Date.now() - started,
  })
}
