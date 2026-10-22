import { TASTE_DOMAINS } from "@najimi/config"
import { tool } from "ai"
import { z } from "zod"

/*
 * The agent's tools as shared definitions: inputs, outputs and what the model is told. The client
 * imports these for typed card parts; the server adds `execute` (apps/web/lib/chat/tools.server.ts).
 * A tool with no execute (askUser) is answered by the person in the chat.
 */

const entityKeys = TASTE_DOMAINS.map((d) => d.key) as [string, ...string[]]
const yearRange = z.object({
  min: z.number().int().min(1800).max(2100).optional(),
  max: z.number().int().min(1800).max(2100).optional(),
})
const range01 = z.object({
  min: z.number().min(0).max(1).optional(),
  max: z.number().min(0).max(1).optional(),
})

export const pickSchema = z.object({
  qlooId: z.string(),
  type: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  caption: z.string().nullable(),
  affinity: z.number().nullable(),
  because: z
    .object({ qlooId: z.string(), name: z.string(), share: z.number().nullable() })
    .nullable(),
  callId: z.string(),
  links: z.record(z.string(), z.string()).optional(),
  area: z.string().nullable().optional(),
  details: z.array(z.string()).optional(),
})
export type Pick = z.infer<typeof pickSchema>

/** What the person answers on a wizard card (validated on the server before it is kept). */
export const askUserOutput = z.object({
  answers: z.array(
    z.object({
      stepId: z.string(),
      question: z.string(),
      choices: z.array(z.string()),
      other: z.string().optional(),
    }),
  ),
  skipped: z.boolean().optional(),
})

/** What the agent can ask Qloo's insights for (see qlooInsights). */
export const insightsInput = z.object({
  title: z.string().max(80).describe("The card's title, in the reply language."),
  ask: z.enum([...entityKeys, "tags", "heatmap", "demographics"]),
  useTaste: z.boolean().optional().describe("Use the person's loves as the signal (default true)."),
  signal: z
    .object({
      entities: z
        .array(
          z.object({ id: z.string().max(64), weight: z.number().int().min(1).max(10).optional() }),
        )
        .max(10)
        .optional(),
      tags: z.array(z.string().max(120)).max(5).optional(),
      boostLove: z.string().max(120).optional(),
      age: z
        .enum(["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"])
        .optional(),
      gender: z.enum(["male", "female"]).optional(),
      audiences: z.array(z.string().max(120)).max(3).optional(),
      location: z.string().max(120).optional(),
    })
    .optional(),
  filter: z
    .object({
      city: z.string().max(120).optional(),
      radiusMeters: z.number().int().min(100).max(200_000).optional(),
      excludeCity: z.string().max(120).optional(),
      countryCode: z.string().length(2).optional(),
      tags: z.array(z.string().max(120)).max(6).optional(),
      tagsMode: z.enum(["any", "all"]).optional(),
      excludeTags: z.array(z.string().max(120)).max(6).optional(),
      tagTypes: z.array(z.string().max(60)).max(4).optional(),
      parentTypes: z.array(z.string().max(40)).max(2).optional(),
      popularity: range01.optional(),
      releaseYear: yearRange.optional(),
      publicationYear: yearRange.optional(),
      finaleYear: yearRange.optional(),
      rating: z
        .object({
          min: z.number().min(0).max(5).optional(),
          max: z.number().min(0).max(5).optional(),
        })
        .optional(),
      contentRating: z.string().max(20).optional(),
      releaseCountry: z.array(z.string().max(60)).max(4).optional(),
      priceLevel: z
        .object({
          min: z.number().int().min(1).max(4).optional(),
          max: z.number().int().min(1).max(4).optional(),
        })
        .optional(),
      hotelClass: z
        .object({
          min: z.number().int().min(1).max(5).optional(),
          max: z.number().int().min(1).max(5).optional(),
        })
        .optional(),
      businessRating: z.object({ min: z.number().min(0).max(5).optional() }).optional(),
      openOn: z
        .enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
        .optional(),
      externalExists: z
        .array(z.enum(["michelin", "resy", "tablet"]))
        .max(3)
        .optional(),
      onlyIds: z.array(z.string().max(64)).max(20).optional(),
      exclude: z.array(z.string().max(64)).max(30).optional(),
    })
    .optional(),
  diversifyBy: z.enum(["city", "metro"]).optional(),
  take: z.number().int().min(1).max(20).optional(),
})
export type InsightsInput = z.infer<typeof insightsInput>

export const toolDefs = {
  qlooSearch: tool({
    description:
      'Find things in Qloo by name: any kind (artist, movie, tv_show, book, podcast, brand, place, destination, videogame, person, locality). Use it to turn a name the person mentions into a Qloo id, then use that id as a signal ("like this"), a filter, or in a comparison.',
    inputSchema: z.object({
      query: z.string().min(1).max(120),
      types: z
        .array(z.enum([...entityKeys, "locality"]))
        .max(4)
        .optional(),
      take: z.number().int().min(1).max(10).optional(),
    }),
    outputSchema: z.object({
      found: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.string(),
          image: z.string().nullable(),
          caption: z.string().nullable(),
        }),
      ),
    }),
  }),

  qlooTags: tool({
    description:
      'Find Qloo tags by meaning, to use as signals or filters: moods and occasions ("rainy day", "date night"), genres, cuisines, dishes, decor and ambience words, dietary options ("vegetarian"), place kinds ("cafe", "bookstore", "museum"), keywords. Optionally limit to tag types such as urn:tag:genre:place, urn:tag:cuisine:qloo, urn:tag:decor:qloo, urn:tag:dietary_option:qloo, urn:tag:keyword:media.',
    inputSchema: z.object({
      query: z.string().min(1).max(80),
      tagTypes: z.array(z.string().max(60)).max(4).optional(),
      take: z.number().int().min(1).max(10).optional(),
    }),
    outputSchema: z.object({
      tags: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
    }),
  }),

  qlooInsights: tool({
    description: `Ask Qloo anything its taste graph can answer; the result renders as a card. The person's weighted loves are the signal by default (useTaste); add or replace signals and filters freely.
- ask: an entity kind (${entityKeys.join(", ")}) for picks; "tags" for the words of a taste (narrow with filter.tagTypes or filter.parentTypes, e.g. urn:entity:place for food and decor words); "heatmap" for where in a city people with this taste are (needs filter.city); "demographics" for the age and gender lean of a taste.
- signal: entities (ids from qlooSearch or earlier picks, with weights 1-10) for "more like this"; tags (ids from qlooTags) for moods; age (24_and_younger, 25_to_29, 30_to_34, 35_to_44, 45_to_54, 55_and_older), gender, audiences (ids from qlooAudiences); location (a city) to lean a taste towards people there; boostLove to make one of their loves count most.
- filter: city / radiusMeters / excludeCity / countryCode (places, destinations), tags + tagsMode (any/all), excludeTags, popularity {min,max} 0-1 (low max = hidden gems), releaseYear, publicationYear, finaleYear, rating (0-5), contentRating, releaseCountry, priceLevel (1-4), hotelClass (1-5), businessRating, openOn (a weekday), externalExists (michelin, resy, tablet), onlyIds (score exactly these: "is X a fit?"), exclude.
- diversifyBy city or metro: one result per city (trips).`,
    inputSchema: insightsInput,
    outputSchema: z.object({
      title: z.string(),
      ask: z.string(),
      personId: z.string(),
      personName: z.string(),
      /** What the request asked, as chips the card shows ({ k: "years", v: "1970–1979" }). */
      asked: z.array(z.object({ k: z.string(), v: z.string() })),
      callId: z.string().nullable(),
      picks: z.array(pickSchema).optional(),
      tags: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            type: z.string(),
            affinity: z.number().nullable(),
          }),
        )
        .optional(),
      heatmap: z
        .object({
          city: z.string(),
          points: z.array(z.object({ lat: z.number(), lon: z.number(), affinity: z.number() })),
          areas: z.array(
            z.object({
              name: z.string(),
              lat: z.number(),
              lon: z.number(),
              affinity: z.number(),
              places: z.array(z.string()),
            }),
          ),
        })
        .optional(),
      demographics: z
        .object({ age: z.record(z.string(), z.number()), gender: z.record(z.string(), z.number()) })
        .optional(),
      note: z.string().nullable(),
    }),
  }),

  qlooCompare: tool({
    description:
      "Compare two tastes in Qloo: two sets of things (\"Fleabag vs Insecure\"), or the person's own taste against a set. Shows what they share (scored) and what's only on each side. Use entity ids from qlooSearch; leave entityIds out on a side for the person's own loves.",
    inputSchema: z.object({
      title: z.string().max(80),
      a: z.object({
        label: z.string().max(60),
        entityIds: z.array(z.string().max(64)).max(10).optional(),
      }),
      b: z.object({
        label: z.string().max(60),
        entityIds: z.array(z.string().max(64)).max(10).optional(),
      }),
    }),
    outputSchema: z.object({
      title: z.string(),
      a: z.string(),
      b: z.string(),
      shared: z.array(z.object({ name: z.string(), score: z.number().nullable() })),
      onlyA: z.array(z.string()),
      onlyB: z.array(z.string()),
      callId: z.string().nullable(),
    }),
  }),

  qlooAudiences: tool({
    description:
      "List Qloo audiences of one kind, to use as a signal (signal.audiences in qlooInsights): communities, global_issues, hobbies_and_interests, investing_interests, leisure, life_stage, lifestyle_preferences_beliefs, professional_area, spending_habits. Never political ones.",
    inputSchema: z.object({
      kind: z.enum([
        "communities",
        "global_issues",
        "hobbies_and_interests",
        "investing_interests",
        "leisure",
        "life_stage",
        "lifestyle_preferences_beliefs",
        "professional_area",
        "spending_habits",
      ]),
      take: z.number().int().min(1).max(30).optional(),
    }),
    outputSchema: z.object({ audiences: z.array(z.object({ id: z.string(), name: z.string() })) }),
  }),

  makeImage: tool({
    description:
      'Make an image (shows an approval card with the cost first in Ask mode). restyle: edit a photo the person shared (sourceUploadId) or an earlier creation (sourceCreationId), keeping the real room, object or person and changing its look, light and decor to their taste. new: make a scene from words (the world of a book, a mood, a look). Write the prompt in English, concrete and photographic, built from the person\'s taste words, and pass the words you used. For a restyle say "keep this exact room/object, layout and camera angle".',
    inputSchema: z.object({
      title: z.string().max(80).describe("The card's title, in the reply language."),
      kind: z.enum(["restyle", "new"]),
      purpose: z.enum(["restyle", "relight", "mood", "portrait", "scene", "outfit"]),
      sourceUploadId: z.string().max(64).optional(),
      sourceCreationId: z.string().max(64).optional(),
      prompt: z.string().min(20).max(2000),
      words: z.array(z.string().max(60)).max(12).describe("The taste words the prompt uses."),
      variants: z
        .number()
        .int()
        .min(1)
        .max(2)
        .optional()
        .describe("Leave at 1; 2 only when the person asks for options to choose from."),
      aspect: z.enum(["landscape", "portrait", "square"]).optional(),
    }),
    outputSchema: z.object({
      runId: z.string().nullable(),
      creationIds: z.array(z.string()),
      title: z.string(),
      kind: z.string(),
      purpose: z.string(),
      words: z.array(z.string()),
      sourceUploadId: z.string().nullable(),
      sourceCreationId: z.string().nullable(),
      personName: z.string(),
      note: z.string().nullable(),
    }),
  }),

  tasteBrief: tool({
    description:
      "Show the taste brief card: the words of a person's taste that a plan or a creation will be built from (look, rooms, mood, food), and the loves behind them. Call it first when planning or making something from their taste (a room, a night, a look), so they see what their taste is made of.",
    inputSchema: z.object({
      focus: z.enum(["home", "food", "style", "culture", "travel"]),
      ask: z
        .string()
        .max(200)
        .describe('What it\'s for, in the reply language ("A reading corner for winter").'),
    }),
    outputSchema: z.object({
      personId: z.string(),
      personName: z.string(),
      focus: z.string(),
      ask: z.string(),
      words: z.record(z.string(), z.array(z.string())),
      loves: z.array(
        z.object({ name: z.string(), image: z.string().nullable(), type: z.string() }),
      ),
      runId: z.string().nullable(),
    }),
  }),

  askUser: tool({
    description:
      "Ask the person up to 3 quick multiple-choice questions in one card, when their answer really changes the result (a room's uses, how many people, a budget). Never for things you can decide or that their taste already answers. Write questions and options in the reply language.",
    inputSchema: z.object({
      title: z.string().max(80),
      steps: z
        .array(
          z.object({
            id: z.string().max(40),
            question: z.string().max(160),
            options: z
              .array(z.object({ id: z.string().max(40), label: z.string().max(60) }))
              .min(2)
              .max(6),
            multi: z.boolean().optional(),
          }),
        )
        .min(1)
        .max(3),
    }),
    outputSchema: askUserOutput,
  }),
} as const

export type ToolDefs = typeof toolDefs
export type ToolName = keyof ToolDefs
