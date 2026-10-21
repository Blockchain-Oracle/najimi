import { agentModel, agentModelId, type NajimiUIMessage } from "@najimi/agent"
import { LOCALES } from "@najimi/config"
import { db, schema } from "@najimi/db"
import { generateText, Output } from "ai"
import { z } from "zod"
import { body, fail, json, withSession } from "@/lib/api"
import { messagesOf, ownedChat } from "@/lib/chat/store"
import { allow } from "@/lib/rate-limit"

const input = z.object({ chatId: z.uuid() })

const draft = z.object({
  name: z.string().describe("Two to five words, sentence case"),
  description: z.string().describe("One short sentence: what running it gives you"),
  steps: z.array(z.string()).min(2).max(7),
})

/** What happened in a chat, in a few lines: what the person said and what Najimi did. */
function transcript(messages: NajimiUIMessage[]): string {
  const lines: string[] = []
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "text" && p.text.trim())
        lines.push(`${m.role === "user" ? "Person" : "Najimi"}: ${p.text.trim().slice(0, 400)}`)
      else if (p.type === "file" && m.role === "user") lines.push("Person: [shared a photo]")
      else if (p.type.startsWith("tool-") && "input" in p && p.input)
        lines.push(`Najimi used ${p.type.slice(5)} ${JSON.stringify(p.input).slice(0, 240)}`)
    }
  }
  return lines.join("\n").slice(-8000)
}

/**
 * A first draft of a workflow from a chat that went well: the steps, written as the person would
 * ask for them next time, for anyone (no names, no one-off details). The person edits it before
 * saving.
 */
export async function POST(request: Request) {
  const auth = await withSession()
  if ("error" in auth) return auth.error
  const userId = auth.session.user.id
  const parsed = await body(request, input)
  if ("error" in parsed) return parsed.error
  if (!allow(`workflow-draft:${userId}`, 12, 60 * 60_000)) return fail("Give it a minute", 429)
  const chat = await ownedChat(userId, parsed.data.chatId)
  if (!chat) return fail("Unknown chat", 404)
  const messages = messagesOf(chat)
  if (!messages.some((m) => m.role === "assistant")) return fail("Nothing to save yet", 409)
  const language = LOCALES.find((l) => l.code === chat.locale)?.name ?? "English"
  const started = Date.now()
  const result = await generateText({
    model: agentModel(),
    instructions: `Turn this chat into a reusable workflow someone can run again with Najimi, a taste copilot that knows what people love (through Qloo) and makes things for their lives.
Write in ${language}. The steps are what the person would ask Najimi to do, in order, in their voice ("Restyle my room photo with…", "Find lamps from brands that fit my taste"), so they work for anyone: no names, no one-off details from this chat. Keep what made it good (the order, the kinds of things made, the checks). Two to seven steps, one line each.`,
    prompt: transcript(messages),
    output: Output.object({ schema: draft }),
    maxOutputTokens: 1200,
    providerOptions: { openai: { reasoningEffort: "low" } },
  }).catch((e: unknown) => {
    console.error("[workflow-draft]", e)
    return null
  })
  if (!result?.output) return fail("Couldn't draft it. Write the steps yourself.", 502)
  await db
    .insert(schema.llmCalls)
    .values({
      userId,
      chatId: chat.id,
      purpose: "workflow-draft",
      provider: agentModelId().split(":")[0],
      model: agentModelId(),
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
      ms: Date.now() - started,
    })
    .catch(() => undefined)
  const { name, description, steps } = result.output
  return json({
    name: name.trim().slice(0, 80),
    description: description.trim().slice(0, 240),
    instructions: steps.map((s, i) => `${i + 1}. ${s.trim()}`).join("\n"),
  })
}
