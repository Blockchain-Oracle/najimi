import { FEED, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { tool } from "ai"
import { z } from "zod"

/*
 * The agent's tools as shared definitions: inputs, outputs and what the model is told. The client
 * imports these for typed card parts; the server adds `execute` (packages/agent/src/server/tools.ts).
 * A tool with no execute (askUser) is answered by the person in the chat.
 */

const entityKeys = TASTE_DOMAINS.map((d) => d.key) as [string, ...string[]]
const feedKeys = Object.keys(FEED.mix) as [string, ...string[]]
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

/** A plan as the card shows it (the full plan lives at /plan/<token>). */
const planOutput = z.object({
  token: z.string().nullable(),
  kind: z.enum(["night", "trip"]),
  title: z.string(),
  city: z.string().nullable(),
  /** When it starts, ISO. */
  startsAt: z.string().nullable(),
  stops: z.array(
    z.object({
      day: z.number(),
      slot: z.string(),
      name: z.string(),
      image: z.string().nullable(),
      area: z.string().nullable(),
      at: z.string().nullable(),
      why: z.string().nullable(),
      fits: z.array(
        z.object({ name: z.string(), look: z.string().nullable(), fit: z.number().nullable() }),
      ),
    }),
  ),
  route: z.object({ profile: z.string(), minutes: z.number(), km: z.number() }).nullable(),
  shows: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      venue: z.string().nullable(),
      localTime: z.string().nullable(),
      image: z.string().nullable(),
    }),
  ),
  note: z.string().nullable(),
})

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

  groupFit: tool({
    description:
      "In a circle: find something for everyone in the room (a place tonight, a film, music, a trip) from all their tastes blended equally, and score each pick against each member's own taste, so you can say who it fits and why. Use it for 'find us a spot tonight', 'what should we watch', 'a playlist for all of us'. Places default to the asker's city; pass Qloo tag ids (from qlooTags) for kinds like rooftop bar or suya.",
    inputSchema: z.object({
      title: z
        .string()
        .max(80)
        .describe('The card title, in the reply language ("Tonight in Lekki").'),
      kind: z.enum(entityKeys),
      city: z.string().max(80).optional(),
      tags: z.array(z.string().max(120)).max(4).optional(),
      take: z.number().int().min(3).max(8).optional(),
    }),
    outputSchema: z.object({
      title: z.string(),
      kind: z.string(),
      members: z.array(z.object({ name: z.string(), look: z.string().nullable() })),
      picks: z.array(
        pickSchema.extend({
          fits: z.array(z.object({ name: z.string(), fit: z.number().nullable() })),
        }),
      ),
      callId: z.string().nullable(),
      note: z.string().nullable(),
    }),
  }),

  planNight: tool({
    description:
      "Plan a night out near an area at a time: drinks, then food, then somewhere late, from the asker's taste (in a circle with everyone: the whole room blended so each person counts the same), each stop with each person's own fit, the real route between stops, and shows on that night nearby. Use for 'plan our night', '9pm in Lekki', 'where should we go out tonight'. The card has the map, the plan page and the calendar; places can then be booked.",
    inputSchema: z.object({
      area: z
        .string()
        .max(80)
        .describe("A neighbourhood or part of town (Lekki, Victoria Island, Shoreditch)."),
      city: z.string().max(80).optional(),
      time: z
        .string()
        .regex(/^\d{1,2}:\d{2}$/)
        .describe("Their local start time, 24-hour (21:00)."),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Default: today where they are."),
      everyone: z
        .boolean()
        .optional()
        .describe("In a circle: plan for the whole room (default true). False: just the asker."),
    }),
    outputSchema: planOutput,
  }),

  planTrip: tool({
    description:
      "Plan a trip to a city: one area a day from where this taste lives there (Qloo's heatmap, areas named by its places), with a morning, afternoon and evening stop in it, routed, each with why (and each person's fit in a circle). Use for 'Lisbon for three days', 'a weekend in Accra'. The card links to the plan page; a hotel near day one can then be found and booked.",
    inputSchema: z.object({
      city: z.string().max(80),
      days: z.number().int().min(1).max(5),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("The first day. Default: today where they are."),
      everyone: z.boolean().optional(),
    }),
    outputSchema: planOutput,
  }),

  findHotels: tool({
    description:
      "Find hotels with real prices near an area for dates and guests, bookable right here: the guest pays in Nuitee's own payment sheet (Nuitee is the merchant of record). Use when someone needs somewhere to stay (a trip, a night that ends late). The card has a Book button on each; then say which you'd pick and why.",
    inputSchema: z.object({
      near: z.string().max(80).describe("An area, a neighbourhood or a place (Ikoyi, Alfama)."),
      city: z.string().max(80).optional(),
      checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      nights: z.number().int().min(1).max(14),
      guests: z.number().int().min(1).max(8),
    }),
    outputSchema: z.object({
      near: z.string(),
      checkin: z.string(),
      checkout: z.string(),
      guests: z.number(),
      offers: z.array(
        z.object({
          offerId: z.string(),
          hotelId: z.string(),
          name: z.string(),
          photo: z.string().nullable(),
          address: z.string().nullable(),
          stars: z.number().nullable(),
          rating: z.number().nullable(),
          price: z.object({ amount: z.number(), currency: z.string() }),
          refundable: z.boolean(),
          room: z.string().nullable(),
          board: z.string().nullable(),
        }),
      ),
      note: z.string().nullable(),
    }),
  }),

  callToBook: tool({
    description:
      "Phone a restaurant, bar or club to book a table when it has no online booking: a short AI voice call that says up front it's an AI calling for them and that it's recorded, only between 8am and 9pm. Pass the venue's website (Najimi reads its number there) or the number itself; if neither works, ask them for the number. They approve the call first; the result comes back into this chat.",
    inputSchema: z.object({
      venue: z.string().max(120),
      website: z.string().url().max(300).optional(),
      phone: z
        .string()
        .max(30)
        .optional()
        .describe("The venue's number, international form if known."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      time: z.string().regex(/^\d{1,2}:\d{2}$/),
      party: z.number().int().min(1).max(20),
      notes: z.string().max(200).optional(),
    }),
    outputSchema: z.object({
      bookingId: z.string().nullable(),
      status: z.enum(["calling", "needs-number", "closed-hours", "unavailable"]),
      phone: z.string().nullable(),
      note: z.string().nullable(),
    }),
  }),

  businessPlan: tool({
    description:
      "Build a plan for the asker's business (Business mode): who its fans are and what else they love, where they cluster in the city, its street's own scene, what's rising around it, and ideas (menu, music, nights, partners, posts) each backed by Qloo. Call it once you know what it is, its name and where it is (city, plus street or area); a website, who they think their customers are and the decision they're weighing make it sharper. It takes about a minute; the card shows each step and opens the plan.",
    inputSchema: z.object({
      name: z.string().min(1).max(120),
      kind: z
        .string()
        .min(2)
        .max(60)
        .describe("What it is, in plain words: café, barbershop, electrician…"),
      city: z.string().max(80),
      address: z.string().max(160).optional().describe("Street or neighbourhood."),
      website: z.string().max(300).optional(),
      instagram: z.string().max(60).optional(),
      audience: z.string().max(240).optional().describe("Who they think their customers are."),
      decision: z.string().max(240).optional().describe("What they're trying to decide."),
    }),
    outputSchema: z.object({
      businessId: z.string().nullable(),
      runId: z.string().nullable(),
      name: z.string(),
      note: z.string().nullable(),
    }),
  }),

  postToX: tool({
    description:
      "Post on X for the person asking: a post in their own voice (plain, specific, no hashtag spam, under 280 characters) about what they asked for or something from their taste. They see the exact post and approve it first. It goes out from their connected X; without one, the card gives them a one-tap link to post it themselves.",
    inputSchema: z.object({
      text: z.string().min(1).max(280).describe("The exact post, as it will appear."),
    }),
    outputSchema: z.object({
      status: z.enum(["posted", "link", "failed"]),
      url: z.string().nullable(),
      handle: z.string().nullable(),
      note: z.string().nullable(),
    }),
  }),

  startGame: tool({
    description:
      "Start a taste game when someone wants to play: 'wavelength' (guess how much someone would love five things; Qloo knows), 'knowme' (which of these did they pick as a love?), 'twins' (in a circle: who loves this?), 'blind' (Qloo predicts how YOU will feel about five things you may not know). For wavelength and knowme, name whose taste it's about by their @username (default: the person asking). The card has the play button and a challenge link; you play too.",
    inputSchema: z.object({
      kind: z.enum(["wavelength", "knowme", "twins", "blind"]),
      about: z.string().max(40).optional().describe("Whose taste, by @username."),
    }),
    outputSchema: z.object({
      token: z.string().nullable(),
      kind: z.string(),
      title: z.string(),
      subject: z.object({ name: z.string(), look: z.string().nullable() }).nullable(),
      count: z.number(),
      note: z.string().nullable(),
    }),
  }),

  steerFeed: tool({
    description:
      "Tune the person's feed when they ask for more or less of something: turn categories up, down or off (level 0 off, 1 less, 2 normal, 3 more), add something to their taste (often the card they're looking at: 'more like this', 'I love this'), or make one of their loves count more or less. Their feed restarts on the new mix at once. Use it for 'less films', 'no podcasts', 'more music like this', 'more of Burna Boy'.",
    inputSchema: z.object({
      mix: z
        .array(
          z.object({ category: z.enum(feedKeys), level: z.number().int().min(0).max(FEED.mixMax) }),
        )
        .max(8)
        .optional(),
      love: z
        .object({ qlooId: z.string(), name: z.string(), type: z.string() })
        .optional()
        .describe(
          "Something to add to their taste, by its Qloo id (the card on screen, or a search hit).",
        ),
      weights: z
        .array(
          z.object({
            loveName: z.string(),
            weight: z.number().int().min(TASTE.weightMin).max(TASTE.weightMax),
          }),
        )
        .max(10)
        .optional()
        .describe("Loves to count more or less, by name (1 barely … 10 most)."),
    }),
    outputSchema: z.object({
      mix: z.array(z.object({ category: z.string(), level: z.number() })),
      loved: z.string().nullable(),
      weights: z.array(z.object({ name: z.string(), weight: z.number() })),
      note: z.string().nullable(),
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
