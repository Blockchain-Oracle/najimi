import "server-only"
import { agentModel, brainModelId, costOf } from "@najimi/agent"
import { type Candidate, resolve } from "@najimi/connectors"
import { db, schema } from "@najimi/db"
import type { SocialPlatform } from "@najimi/db/schema"
import { type Love, profileInsights } from "@najimi/qloo"
import { generateObject } from "ai"
import { z } from "zod"

/*
 * How much of a feed is you (W15). A screenshot of For You / Explore / Home is read by a vision
 * model (names, handles, topics on screen; the picture is never stored), every name is matched to
 * Qloo, and each match is scored against the person's taste. The share that fits is the score;
 * what doesn't fit is listed, so the tune-up can steer away from it.
 */

const seen = z.object({
  items: z
    .array(
      z.object({
        name: z
          .string()
          .max(120)
          .describe("A creator, artist, brand, show, film, game, place or topic shown."),
        kind: z.enum([
          "creator",
          "artist",
          "brand",
          "show",
          "film",
          "game",
          "place",
          "topic",
          "other",
        ]),
        handle: z
          .string()
          .max(40)
          .nullable()
          .describe("Their @handle if it's visible, without the @."),
      }),
    )
    .max(30),
})

const TYPE_OF: Record<string, string | null> = {
  artist: "urn:entity:artist",
  brand: "urn:entity:brand",
  show: "urn:entity:tv_show",
  film: "urn:entity:movie",
  game: "urn:entity:videogame",
  place: "urn:entity:place",
  creator: "urn:entity:person",
  topic: null,
  other: null,
}

/** A fit at or above this reads as "you" (Qloo scores a taste's neighbourhood around 0.8–0.95). */
const FITS = 0.8

export async function scoreFeed(input: {
  userId: string
  platform: SocialPlatform
  image: Uint8Array
  loves: Love[]
}) {
  const modelId = brainModelId()
  const started = Date.now()
  const read = await generateObject({
    model: agentModel(modelId),
    schema: seen,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a screenshot of someone's ${input.platform} feed. List every creator, artist, brand, show, film, game, place or topic you can identify on it (with the @handle when it's visible). Skip ads' small print and the app's own buttons.`,
          },
          { type: "image", image: input.image, mediaType: "image/jpeg" },
        ],
      },
    ],
    maxOutputTokens: 1200,
    providerOptions: { openai: { reasoningEffort: "low" } },
  })
  const usage = read.usage as { inputTokens?: number; outputTokens?: number }
  await db
    .insert(schema.llmCalls)
    .values({
      userId: input.userId,
      purpose: "feed-score",
      provider: modelId.split(":")[0],
      model: modelId,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      ms: Date.now() - started,
      costUsd: costOf(modelId, { input: usage.inputTokens, output: usage.outputTokens }),
    })
    .catch(() => undefined)

  const shown = read.object.items
  const handleKind = input.platform === "x" ? "twitter" : "instagram"
  const candidates: Candidate[] = shown.flatMap((s): Candidate[] =>
    s.handle && /^[A-Za-z0-9_.]{1,30}$/.test(s.handle)
      ? [{ name: s.name, type: null, external: { kind: handleKind, id: s.handle.toLowerCase() } }]
      : TYPE_OF[s.kind]
        ? [{ name: s.name, type: TYPE_OF[s.kind] ?? null }]
        : [],
  )
  const found = candidates.length
    ? await resolve(candidates, { userId: input.userId, purpose: "Feed score: what's on screen" })
    : []
  // Each match scored against their taste, one shortlist per kind of thing.
  const byType = new Map<string, string[]>()
  for (const f of found) byType.set(f.type, [...(byType.get(f.type) ?? []), f.qlooId])
  const fit = new Map<string, number>()
  await Promise.all(
    [...byType].map(([filterType, ids]) =>
      profileInsights(
        input.loves,
        { filterType, only: ids, take: ids.length },
        { userId: input.userId, purpose: "Feed score: how much is you" },
      )
        .then((r) => {
          for (const i of r.items) if (i.affinity != null) fit.set(i.entityId, i.affinity)
        })
        .catch(() => undefined),
    ),
  )
  const matched = found
    .map((f) => ({ qlooId: f.qlooId, name: f.name, image: f.image, fit: fit.get(f.qlooId) ?? 0 }))
    .sort((a, b) => b.fit - a.fit)
  const mine = matched.filter((m) => m.fit >= FITS)
  const matchedNames = new Set(found.map((f) => f.from.toLowerCase()))
  const off = [
    ...matched.filter((m) => m.fit < FITS).map((m) => m.name),
    ...shown
      .filter(
        (s) =>
          !matchedNames.has((s.handle ?? s.name).toLowerCase()) &&
          !matchedNames.has(s.name.toLowerCase()),
      )
      .map((s) => s.name),
  ].slice(0, 20)
  const total = Math.max(shown.length, 1)
  const score = Math.round((mine.length / total) * 100)
  const [row] = await db
    .insert(schema.feedScores)
    .values({
      userId: input.userId,
      platform: input.platform,
      score,
      matched: mine.slice(0, 20),
      off,
    })
    .returning()
  return { score, seen: shown.length, matched: mine.slice(0, 20), off, id: row?.id ?? null }
}
