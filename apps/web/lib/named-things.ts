import "server-only"
import { agentModel, costOf, lightModelId } from "@najimi/agent"
import type { Candidate } from "@najimi/connectors"
import { db, schema } from "@najimi/db"
import { generateObject } from "ai"
import { z } from "zod"

/*
 * The culture someone names in their own posts ("finally watched Shōgun", "SZA on repeat"), read
 * by the light model so Qloo can match it. Only names of real works, artists, brands and places
 * come back; opinions, people they know and the rest are left out.
 */

const named = z.object({
  items: z
    .array(
      z.object({
        name: z.string().max(120).describe("The exact name of the work, artist, brand or place."),
        kind: z.enum([
          "artist",
          "album",
          "film",
          "show",
          "book",
          "podcast",
          "game",
          "brand",
          "place",
        ]),
      }),
    )
    .max(40),
})

const TYPE_OF: Record<z.infer<typeof named>["items"][number]["kind"], string> = {
  artist: "urn:entity:artist",
  album: "urn:entity:album",
  film: "urn:entity:movie",
  show: "urn:entity:tv_show",
  book: "urn:entity:book",
  podcast: "urn:entity:podcast",
  game: "urn:entity:videogame",
  brand: "urn:entity:brand",
  place: "urn:entity:place",
}

/** Most posts read at once, and the most of each. */
export const POSTS = 60
export const CHARS = 280

export async function namedThings(input: {
  userId: string
  platform: string
  texts: string[]
}): Promise<Candidate[]> {
  const texts = input.texts.slice(0, POSTS).map((t) => t.slice(0, CHARS))
  if (!texts.length) return []
  const modelId = lightModelId()
  const started = Date.now()
  const read = await generateObject({
    model: agentModel(modelId),
    schema: named,
    prompt: `These are recent ${input.platform} posts, likes or titles from one person. List the artists, albums, films, TV shows, books, podcasts, games, brands and venues (bars, restaurants, clubs, shops, museums) they name or clearly refer to, with their exact names. Leave out countries, cities, private people, opinions, the channel, network or account that posted something, and anything you're unsure is a real title.\n\n${texts.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
    maxOutputTokens: 900,
    providerOptions: { openai: { reasoningEffort: "low" } },
  }).catch(() => null)
  if (!read) return []
  const usage = read.usage as { inputTokens?: number; outputTokens?: number }
  await db
    .insert(schema.llmCalls)
    .values({
      userId: input.userId,
      purpose: "named-things",
      provider: modelId.split(":")[0],
      model: modelId,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      ms: Date.now() - started,
      costUsd: costOf(modelId, { input: usage.inputTokens, output: usage.outputTokens }),
    })
    .catch(() => undefined)
  const seen = new Set<string>()
  return read.object.items.flatMap((i) => {
    const key = `${i.kind}:${i.name.toLowerCase()}`
    if (seen.has(key) || i.name.trim().length < 2) return []
    seen.add(key)
    // Only an exact name counts: "Kenya" mustn't become a market called Kenyatta.
    return [{ name: i.name.trim(), type: TYPE_OF[i.kind], exactName: true }]
  })
}
