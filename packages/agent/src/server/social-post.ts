import { db, schema } from "@najimi/db"
import { generateText } from "ai"
import { and, desc, eq, gte } from "drizzle-orm"
import { agentModel, costOf, lightModelId } from "../models"

/*
 * The Post agent's writer: one short post in the person's own voice about what they've loved
 * lately, from their loves and their taste's words only. Plans, times, places and people never go
 * in: a post is public, and those aren't Najimi's to share.
 */

const WEEK_MS = 7 * 86_400_000
/** X's limit, with room to spare. */
const MAX_CHARS = 260

export async function draftPost(userId: string, platform: "x" | "instagram") {
  const [self] = await db
    .select({ id: schema.people.id, name: schema.people.name })
    .from(schema.people)
    .where(and(eq(schema.people.ownerId, userId), eq(schema.people.isSelf, true)))
  if (!self) return null
  const [recent, all, [taste]] = await Promise.all([
    db
      .select({ name: schema.loves.name, type: schema.loves.type })
      .from(schema.loves)
      .where(
        and(
          eq(schema.loves.personId, self.id),
          gte(schema.loves.createdAt, new Date(Date.now() - WEEK_MS)),
        ),
      )
      .orderBy(desc(schema.loves.createdAt))
      .limit(6),
    db
      .select({ name: schema.loves.name, type: schema.loves.type })
      .from(schema.loves)
      .where(eq(schema.loves.personId, self.id))
      .orderBy(desc(schema.loves.weight))
      .limit(8),
    db
      .select({ words: schema.tastes.words })
      .from(schema.tastes)
      .where(eq(schema.tastes.personId, self.id)),
  ])
  const loves = recent.length ? recent : all
  if (!loves.length) return null
  const words = taste?.words ? [...taste.words.aesthetic, ...taste.words.lifestyle].slice(0, 6) : []
  const modelId = lightModelId()
  const started = Date.now()
  const read = await generateText({
    model: agentModel(modelId),
    prompt: `Write one ${platform === "x" ? "post for X" : "Instagram caption"} in the first person, as ${self.name}, about what they've been into ${recent.length ? "this week" : "lately"}: ${loves.map((l) => `${l.name} (${l.type.replace("urn:entity:", "")})`).join(", ")}.${words.length ? ` Their taste in words: ${words.join(", ")}.` : ""} Sound like a person, not a brand: warm, specific, a little playful. At most ${MAX_CHARS} characters, at most one hashtag, no @mentions, no links, no emojis in a row. Never mention plans, dates, times, places they're going or other people. Reply with the post only.`,
    maxOutputTokens: 200,
    providerOptions: { openai: { reasoningEffort: "low" } },
  }).catch(() => null)
  const text = read?.text
    .trim()
    .replace(/^["“]|["”]$/g, "")
    .slice(0, MAX_CHARS)
  if (!read || !text) return null
  const usage = read.usage as { inputTokens?: number; outputTokens?: number }
  await db
    .insert(schema.llmCalls)
    .values({
      userId,
      purpose: "post-draft",
      provider: modelId.split(":")[0],
      model: modelId,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      ms: Date.now() - started,
      costUsd: costOf(modelId, { input: usage.inputTokens, output: usage.outputTokens }),
    })
    .catch(() => undefined)
  const [draft] = await db.insert(schema.postDrafts).values({ userId, platform, text }).returning()
  return draft ?? null
}
