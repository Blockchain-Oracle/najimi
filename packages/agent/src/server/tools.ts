import { safeZone, todayIn, zonedTime } from "@najimi/booking"
import { CALL_HOURS, callsOn, placeCall, venueZone } from "@najimi/booking/calls"
import { hotelsNear, hotelsOn } from "@najimi/booking/nuitee"
import { locate, planNight, planTrip } from "@najimi/booking/plan"
import { FEED, MEDIA, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { PlatformError } from "@najimi/connectors/errors"
import { connectionOf, noteConnection, secretOf } from "@najimi/connectors/sessions"
import { xPost } from "@najimi/connectors/x"
import { db, schema } from "@najimi/db"
import { createRound, TITLES } from "@najimi/games/round"
import { enqueue, enqueueAt, enqueueDebounced } from "@najimi/jobs"
import {
  audiences,
  blendLoves,
  compare,
  type Domain,
  type ExploreInput,
  entities,
  explore,
  findTags,
  type Love,
  nameAreas,
  profileInsights,
  profilePicks,
  search,
} from "@najimi/qloo"
import { normalisePhone, venuePhone } from "@najimi/sources"
import { tool } from "ai"
import { and, asc, count, eq, or } from "drizzle-orm"
import type { z } from "zod"
import { type insightsInput, type Pick, toolDefs } from "../tools"
import { startBusiness } from "./business"
import { startPollForNajimi } from "./polls"
import { notifyGame } from "./room"
import { charge, refund } from "./usage"

/** Who a turn acts for and on: the signed-in user, their chat and their own taste profile. */
export type TurnContext = {
  userId: string
  guest: boolean
  chatId: string
  /** The asker's time zone (IANA), for "9pm" in a plan. */
  tz?: string | null
  /** The user's own taste profile. */
  person: typeof schema.people.$inferSelect
}

type InsightsInput = z.infer<typeof insightsInput>

const TYPE_OF = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.key, d.type])) as Record<
  string,
  string
>

async function lovesOf(personId: string): Promise<Love[]> {
  const rows = await db
    .select()
    .from(schema.loves)
    .where(eq(schema.loves.personId, personId))
    .orderBy(asc(schema.loves.createdAt))
  return rows.map((r) => ({ qlooId: r.qlooId, name: r.name, weight: r.weight }))
}

/** Who's going: the asker, or (in a circle, by default) everyone in the room. */
async function goersOf(ctx: TurnContext, everyone: boolean | undefined) {
  const [chat] = await db
    .select({ kind: schema.chats.kind })
    .from(schema.chats)
    .where(eq(schema.chats.id, ctx.chatId))
  const room = chat && chat.kind !== "agent" && everyone !== false
  const people = room
    ? (
        await db
          .select({ person: schema.people })
          .from(schema.chatMembers)
          .innerJoin(
            schema.people,
            and(
              eq(schema.people.ownerId, schema.chatMembers.userId),
              eq(schema.people.isSelf, true),
            ),
          )
          .where(eq(schema.chatMembers.chatId, ctx.chatId))
      ).map((r) => r.person)
    : [ctx.person]
  return Promise.all(
    people.map(async (p) => ({ name: p.name, look: p.look, loves: await lovesOf(p.id) })),
  )
}

/** A plan as its card shows it. */
function planCard(
  plan: typeof schema.plans.$inferSelect,
  shows: {
    name: string
    url: string
    venue: string | null
    localTime: string | null
    image: string | null
  }[],
) {
  const minutes = plan.route?.legs.reduce((n, l) => n + l.minutes, 0) ?? 0
  const km = plan.route?.legs.reduce((n, l) => n + l.km, 0) ?? 0
  return {
    token: plan.token,
    kind: plan.kind,
    title: plan.title,
    city: plan.city,
    startsAt: plan.startsAt?.toISOString() ?? null,
    stops: plan.stops.map((st) => ({
      day: st.day,
      slot: st.slot,
      qlooId: st.qlooId,
      name: st.name,
      image: st.image,
      area: st.area,
      at: st.at,
      why: st.why,
      fits: st.fits,
    })),
    route: plan.route
      ? { profile: plan.route.profile, minutes, km: Math.round(km * 10) / 10 }
      : null,
    shows,
    note: null,
  }
}

/** A tag id as words: `urn:tag:keyword:media:rainy_day` → "rainy day". */
const tagWords = (id: string) => (id.split(":").at(-1) ?? id).replaceAll("_", " ")

const span = (r: { min?: number; max?: number } | undefined) =>
  r ? `${r.min ?? "…"}–${r.max ?? "…"}` : null

/** What a request asked for, as chips the card shows (the kinds are translated on the page). */
function askedOf(input: InsightsInput, city: string | null) {
  const s = input.signal ?? {}
  const f = input.filter ?? {}
  const out: { k: string; v: string }[] = []
  const add = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") out.push({ k, v: String(v) })
  }
  add("city", city)
  add("near", s.location)
  for (const t of s.tags ?? []) add("mood", tagWords(t))
  add("boost", s.boostLove)
  add("age", s.age?.replaceAll("_", " "))
  add("gender", s.gender)
  if (s.entities?.length) add("like", s.entities.length)
  add("years", span(f.releaseYear))
  add("published", span(f.publicationYear))
  if (f.popularity?.max !== undefined) add("lessKnown", Math.round(f.popularity.max * 100))
  if (f.popularity?.min !== undefined) add("popular", Math.round(f.popularity.min * 100))
  add("rating", span(f.rating))
  add("price", span(f.priceLevel))
  add("hotel", span(f.hotelClass))
  add("open", f.openOn)
  for (const e of f.externalExists ?? []) add("listed", e)
  for (const t of f.tags ?? []) add("kind", tagWords(t))
  add("country", f.countryCode)
  add("notIn", f.excludeCity)
  if (f.onlyIds?.length) add("fit", f.onlyIds.length)
  add("onePer", input.diversifyBy)
  return out
}

const pickLine = (p: Pick, i: number) =>
  `${i + 1}. ${p.name} [id ${p.qlooId}]${p.caption ? ` (${p.caption})` : ""}${p.details?.length ? ` known for ${p.details.join(", ")}` : ""}${p.because ? ` — because they love ${p.because.name}` : ""}${p.affinity != null ? ` — ${Math.round(p.affinity * 100)}% match` : ""}`

const ENTITY_ASKS = new Set(TASTE_DOMAINS.map((d) => d.key as string))
const FILTER_TYPE: Record<string, string> = {
  tags: "urn:tag",
  heatmap: "urn:heatmap",
  demographics: "urn:demographics",
}

/** The tools of one turn, each bound to the user and their taste. */
/** Whether two people follow each other (what "friends" means for who sees a taste). */
async function followEachOther(a: string, b: string): Promise<boolean> {
  const rows = await db
    .select({ followerId: schema.follows.followerId })
    .from(schema.follows)
    .where(
      or(
        and(eq(schema.follows.followerId, a), eq(schema.follows.followeeId, b)),
        and(eq(schema.follows.followerId, b), eq(schema.follows.followeeId, a)),
      ),
    )
  return rows.length === 2
}

export function buildTools(ctx: TurnContext, messageId: () => string | undefined) {
  const call = (purpose: string) => ({
    userId: ctx.userId,
    chatId: ctx.chatId,
    messageId: messageId(),
    purpose,
  })

  return {
    qlooSearch: tool({
      ...toolDefs.qlooSearch,
      execute: async (input) => {
        const types = input.types?.map((k) =>
          k === "locality" ? "urn:entity:locality" : (TYPE_OF[k] ?? k),
        )
        const r = await search(
          { query: input.query, types, take: input.take ?? 5 },
          call(`Find “${input.query}”`),
        )
        return {
          found: r.data.map((e) => ({
            id: e.entityId,
            name: e.name,
            type: e.type ?? "",
            image: e.image,
            caption: e.caption,
          })),
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.found.length
          ? output.found
              .map(
                (f) =>
                  `${f.name} (${f.type.replace("urn:entity:", "")}${f.caption ? `, ${f.caption}` : ""}) id ${f.id}`,
              )
              .join("\n")
          : "Nothing found in Qloo.",
      }),
    }),

    qlooTags: tool({
      ...toolDefs.qlooTags,
      execute: async (input) => {
        const r = await findTags(
          { query: input.query, tagTypes: input.tagTypes, take: input.take ?? 6 },
          call(`Tags for “${input.query}”`),
        )
        return {
          tags: r.data.flatMap((t) => {
            const id = t.id ?? t.tag_id
            return id ? [{ id, name: t.name, type: t.subtype ?? t.types?.[0] ?? "" }] : []
          }),
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.tags.map((t) => `${t.name}: ${t.id}`).join("\n") || "No tags found.",
      }),
    }),

    qlooInsights: tool({
      ...toolDefs.qlooInsights,
      execute: async (input) => {
        const person = ctx.person
        let loves = input.useTaste === false ? [] : await lovesOf(person.id)
        const boost = input.signal?.boostLove?.toLowerCase()
        if (boost)
          loves = loves.map((l) =>
            l.name.toLowerCase().includes(boost) || boost.includes(l.name.toLowerCase())
              ? { ...l, weight: 10 }
              : l,
          )
        const isEntity = ENTITY_ASKS.has(input.ask)
        const filterType = isEntity
          ? (TYPE_OF[input.ask] ?? "urn:entity:brand")
          : (FILTER_TYPE[input.ask] ?? "urn:tag")
        const local = input.ask === "place" || input.ask === "heatmap"
        const city =
          input.filter?.city ?? (local && !input.filter?.onlyIds?.length ? person.city : null)
        const entities = [
          ...loves.map((l) => ({ id: l.qlooId, weight: l.weight })),
          ...(input.signal?.entities ?? []).map((e) => ({ id: e.id, weight: e.weight ?? 8 })),
        ]
        const base = {
          title: input.title,
          ask: input.ask,
          personId: person.id,
          personName: person.name,
          asked: askedOf(input, city),
        }
        if (local && !city) return { ...base, callId: null, note: "No city: ask which city." }
        if (
          !entities.length &&
          !input.signal?.tags?.length &&
          !input.signal?.age &&
          !input.signal?.location
        )
          return { ...base, callId: null, note: "No signal: add something they love." }

        // Tags must be Qloo ids; a plain word ("chill") is looked up as a tag first.
        const asTagIds = async (list: string[] | undefined) =>
          list?.length
            ? (
                await Promise.all(
                  list.map(async (t) =>
                    t.startsWith("urn:tag:")
                      ? t
                      : ((
                          await findTags({ query: t, take: 1 }, call(`Tag for “${t}”`)).catch(
                            () => null,
                          )
                        )?.data[0]?.id ?? null),
                  ),
                )
              ).filter((t): t is string => Boolean(t))
            : undefined
        const [signalTags, filterTags] = await Promise.all([
          asTagIds(input.signal?.tags),
          asTagIds(input.filter?.tags),
        ])

        const request: ExploreInput = {
          filterType,
          signal: {
            entities,
            tags: signalTags,
            age: input.signal?.age,
            gender: input.signal?.gender,
            audiences: input.signal?.audiences,
            location: input.signal?.location,
          },
          filter: {
            ...input.filter,
            tags: filterTags,
            // Untyped tag analysis mixes every kind of word; default to the ones that describe a person.
            tagTypes:
              input.ask === "tags" &&
              !input.filter?.tagTypes?.length &&
              !input.filter?.parentTypes?.length
                ? [
                    "urn:tag:style:qloo",
                    "urn:tag:emotional_tone:qloo",
                    "urn:tag:aesthetic_property:qloo",
                  ]
                : input.filter?.tagTypes,
            city: city ?? undefined,
            exclude: isEntity
              ? [
                  ...person.excludedIds,
                  ...loves.map((l) => l.qlooId),
                  ...(input.filter?.exclude ?? []),
                ]
              : undefined,
          },
          diversifyBy: input.diversifyBy,
          withImage: isEntity && !["destination", "person", "videogame"].includes(input.ask),
          take: input.take ?? (isEntity ? 6 : input.ask === "tags" ? 12 : undefined),
        }
        try {
          const r = await explore(request, loves, call(input.title))
          if (r.kind === "entities")
            return {
              ...base,
              callId: r.callId,
              picks: r.picks,
              note: r.picks.length ? null : "Qloo has nothing for this.",
            }
          if (r.kind === "tags") return { ...base, callId: r.callId, tags: r.tags, note: null }
          if (r.kind === "demographics")
            return {
              ...base,
              callId: r.callId,
              demographics: { age: r.age, gender: r.gender },
              note: null,
            }
          const areas = await nameAreas(r.points, request.signal, loves, call(input.title))
          return {
            ...base,
            callId: r.callId,
            heatmap: {
              city: city ?? "",
              points: r.points.map(({ lat, lon, affinity }) => ({ lat, lon, affinity })),
              areas,
            },
            note: null,
          }
        } catch (error) {
          return {
            ...base,
            callId: null,
            note: `Qloo couldn't answer that: ${(error as Error).message}`,
          }
        }
      },
      toModelOutput: ({ output }) => {
        const head = `${output.title} for ${output.personName} (shown as a card)`
        if (output.picks?.length)
          return { type: "text", value: `${head}:\n${output.picks.map(pickLine).join("\n")}` }
        if (output.tags?.length)
          return {
            type: "text",
            value: `${head}: ${output.tags.map((t) => `${t.name} (${t.type.split(":")[2] ?? ""})`).join(", ")}`,
          }
        if (output.heatmap)
          return {
            type: "text",
            value: `${head}: ${output.heatmap.points.length} map cells; strongest areas: ${output.heatmap.areas.map((a) => `${a.name} (${a.places.join(", ")})`).join("; ")}`,
          }
        if (output.demographics)
          return {
            type: "text",
            value: `${head}: age lean ${JSON.stringify(output.demographics.age)}, gender lean ${JSON.stringify(output.demographics.gender)} (positive = above average).`,
          }
        return { type: "text", value: `${head}: ${output.note ?? "nothing"}` }
      },
    }),

    qlooCompare: tool({
      ...toolDefs.qlooCompare,
      execute: async (input) => {
        const side = async (s: { entityIds?: string[] }) =>
          s.entityIds?.length ? s.entityIds : (await lovesOf(ctx.person.id)).map((l) => l.qlooId)
        const [a, b] = await Promise.all([side(input.a), side(input.b)])
        const empty = {
          title: input.title,
          a: input.a.label,
          b: input.b.label,
          shared: [],
          onlyA: [],
          onlyB: [],
          callId: null,
        }
        if (!a.length || !b.length) return empty
        const r = await compare({ a, b }, call(input.title))
        return {
          ...empty,
          shared: r.data.shared.slice(0, 12),
          onlyA: r.data.onlyA.slice(0, 10),
          onlyB: r.data.onlyB.slice(0, 10),
          callId: r.call.callId,
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `${output.title} (shown as a card). Shared: ${output.shared.map((s) => s.name).join(", ") || "nothing"}. Only ${output.a}: ${output.onlyA.join(", ")}. Only ${output.b}: ${output.onlyB.join(", ")}.`,
      }),
    }),

    qlooAudiences: tool({
      ...toolDefs.qlooAudiences,
      execute: async (input) => {
        const r = await audiences(
          { parentTypes: [`urn:audience:${input.kind}`], take: input.take ?? 20 },
          call(`Audiences: ${input.kind}`),
        )
        return { audiences: r.data }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.audiences.map((a) => `${a.name}: ${a.id}`).join("\n") || "None.",
      }),
    }),

    makeImage: tool({
      ...toolDefs.makeImage,
      execute: async (input, { toolCallId }) => {
        const person = ctx.person
        const n = input.variants ?? MEDIA.image.variants
        const base = {
          title: input.title,
          kind: input.kind,
          purpose: input.purpose,
          personName: person.name,
          sourceUploadId: null as string | null,
          sourceCreationId: null as string | null,
        }
        // A source must be the user's own photo (or a shipped sample), or their own creation.
        let sourceUploadId: string | null = null
        let sourceCreationId: string | null = null
        if (input.sourceUploadId) {
          const [u] = await db
            .select()
            .from(schema.uploads)
            .where(eq(schema.uploads.id, input.sourceUploadId))
          if (u && (u.ownerId === ctx.userId || u.sample)) sourceUploadId = u.id
        }
        if (input.sourceCreationId) {
          const [c] = await db
            .select()
            .from(schema.creations)
            .where(
              and(
                eq(schema.creations.id, input.sourceCreationId),
                eq(schema.creations.ownerId, ctx.userId),
              ),
            )
          if (c?.status === "ready" && c.kind === "image") sourceCreationId = c.id
        }
        if (input.kind === "restyle" && !sourceUploadId && !sourceCreationId)
          return {
            ...base,
            runId: null,
            creationIds: [],
            words: [],
            note: "No photo to restyle: ask them to add one, or offer a sample room.",
          }

        // Rule 2: the words a creation is made of come from the person's taste, and are recorded.
        const [taste] = await db
          .select()
          .from(schema.tastes)
          .where(eq(schema.tastes.personId, person.id))
        const known = new Set(
          Object.values(taste?.words ?? {})
            .flat()
            .map((w) => w.toLowerCase()),
        )
        const words = input.words.filter((w) => known.has(w.toLowerCase()))
        const tasteWords = words.length
          ? words
          : Object.values(taste?.words ?? {})
              .flat()
              .slice(0, 6)
        const prompt = `${input.prompt}\n\nTaste words to express: ${tasteWords.join(", ")}.`

        if (!(await charge(ctx.userId, ctx.guest, "images", n)))
          return {
            ...base,
            sourceUploadId,
            sourceCreationId,
            runId: null,
            creationIds: [],
            words: tasteWords,
            note: "allowance",
          }
        const [run] = await db
          .insert(schema.runs)
          .values({
            ownerId: ctx.userId,
            kind: "media",
            chatId: ctx.chatId,
            toolCallId,
            subject: { kind: "image" },
          })
          .returning({ id: schema.runs.id })
        const [job] = await db
          .insert(schema.mediaJobs)
          .values({
            ownerId: ctx.userId,
            chatId: ctx.chatId,
            toolCallId,
            kind: "image",
            provider: "openai",
            model: "",
            runId: run?.id,
            input: {
              prompt,
              aspect: input.aspect ?? "landscape",
              sourceUploadId,
              sourceCreationId,
            },
          })
          .returning({ id: schema.mediaJobs.id })
        if (!run || !job) {
          await refund(ctx.userId, "images", n)
          return {
            ...base,
            sourceUploadId,
            sourceCreationId,
            runId: null,
            creationIds: [],
            words: tasteWords,
            note: "failed",
          }
        }
        const rows = await db
          .insert(schema.creations)
          .values(
            Array.from({ length: n }, () => ({
              ownerId: ctx.userId,
              mediaJobId: job.id,
              chatId: ctx.chatId,
              personId: person.id,
              kind: "image" as const,
              purpose: input.purpose,
              title: input.title,
              prompt,
              words: tasteWords,
              sourceUploadId,
              sourceCreationId,
            })),
          )
          .returning({ id: schema.creations.id })
        await enqueue("mediaGenerate", { jobId: job.id })
        return {
          ...base,
          sourceUploadId,
          sourceCreationId,
          runId: run.id,
          creationIds: rows.map((r) => r.id),
          words: tasteWords,
          note: null,
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.runId
          ? `Making ${output.creationIds.length} image(s) "${output.title}" (ids ${output.creationIds.join(", ")}); the card shows them as they finish. Don't wait for them.`
          : output.note === "allowance"
            ? "Today's image allowance is used up. Say so kindly."
            : `Not made: ${output.note}`,
      }),
    }),

    tasteBrief: tool({
      ...toolDefs.tasteBrief,
      execute: async (input) => {
        const person = ctx.person
        // A profile made moments ago is still computing: give it a few seconds to land.
        for (let i = 0; i < 12; i++) {
          const [t] = await db
            .select({ words: schema.tastes.words })
            .from(schema.tastes)
            .where(eq(schema.tastes.personId, person.id))
          if (!t || t.words) break
          await new Promise((r) => setTimeout(r, 1000))
        }
        const [[taste], rows] = await Promise.all([
          db.select().from(schema.tastes).where(eq(schema.tastes.personId, person.id)),
          db
            .select()
            .from(schema.loves)
            .where(eq(schema.loves.personId, person.id))
            .orderBy(asc(schema.loves.createdAt)),
        ])
        const all = taste?.words
        const families: Record<string, (keyof NonNullable<typeof all>)[]> = {
          home: ["aesthetic", "decor", "ambience", "lifestyle"],
          food: ["cuisine", "dishes", "ambience"],
          style: ["aesthetic", "style", "lifestyle"],
          culture: ["style", "ambience", "aesthetic"],
          travel: ["ambience", "cuisine", "lifestyle"],
        }
        const words = Object.fromEntries(
          (families[input.focus] ?? []).map((f) => [f, all?.[f]?.slice(0, 6) ?? []]),
        )
        return {
          personId: person.id,
          personName: person.name,
          focus: input.focus,
          ask: input.ask,
          words,
          loves: rows.map((r) => ({ name: r.name, image: r.imageUrl, type: r.type })),
          runId: taste?.runId ?? null,
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `Taste brief for ${output.personName} (shown as a card). Words: ${Object.entries(
          output.words,
        )
          .map(([f, w]) => `${f}: ${w.join(", ")}`)
          .join("; ")}. Loves: ${output.loves.map((l) => l.name).join(", ")}.`,
      }),
    }),

    groupFit: tool({
      ...toolDefs.groupFit,
      execute: async (input) => {
        const empty = (note: string) => ({
          title: input.title,
          kind: input.kind,
          members: [],
          picks: [],
          callId: null,
          note,
        })
        // Everyone in the room, each with their own loves.
        const members = await db
          .select({
            name: schema.people.name,
            look: schema.people.look,
            personId: schema.people.id,
            city: schema.people.city,
          })
          .from(schema.chatMembers)
          .innerJoin(
            schema.people,
            and(
              eq(schema.people.ownerId, schema.chatMembers.userId),
              eq(schema.people.isSelf, true),
            ),
          )
          .where(eq(schema.chatMembers.chatId, ctx.chatId))
        if (members.length < 2) return empty("Only works in a circle with two or more people.")
        const lovesBy = await Promise.all(members.map((m) => lovesOf(m.personId)))
        // Blended equally: each member counts the same, whoever loves more things.
        const blended = blendLoves(lovesBy, 24, TASTE.weightMax)
        const city = input.city ?? ctx.person.city ?? members.find((m) => m.city)?.city ?? null
        const domain = input.kind as Domain
        const found = await profilePicks(
          blended,
          domain,
          { city, take: input.take ?? 5, tags: input.tags },
          call(`Something for everyone in the circle: ${input.title}`),
        ).catch(() => null)
        const picks = found?.picks ?? []
        if (!picks.length)
          return {
            ...empty("Qloo has nothing for all of them here; try another angle."),
            members: members.map((m) => ({ name: m.name, look: m.look })),
          }
        // Each member's own fit for each pick (Qloo scores the shortlist against their taste).
        const ids = picks.map((p) => p.qlooId)
        const fits = await Promise.all(
          lovesBy.map((loves, i) =>
            loves.length
              ? profileInsights(
                  loves,
                  {
                    filterType: TYPE_OF[domain] ?? `urn:entity:${domain}`,
                    only: ids,
                    take: ids.length,
                  },
                  call(`How each pick fits ${members[i]?.name ?? "a member"}`),
                )
                  .then((r) => new Map(r.items.map((it) => [it.entityId, it.affinity])))
                  .catch(() => new Map<string, number | null>())
              : Promise.resolve(new Map<string, number | null>()),
          ),
        )
        return {
          title: input.title,
          kind: input.kind,
          members: members.map((m) => ({ name: m.name, look: m.look })),
          picks: picks.map((p) => ({
            ...p,
            area: p.area ?? null,
            fits: members.map((m, i) => ({ name: m.name, fit: fits[i]?.get(p.qlooId) ?? null })),
          })),
          callId: found?.callId ?? null,
          note: null,
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.picks.length
          ? `For everyone (shown as a card): ${output.picks
              .map(
                (p, i) =>
                  `${i + 1}. ${p.name}${p.area ? ` (${p.area})` : ""} — ${p.fits.map((f) => `${f.name} ${f.fit != null ? `${Math.round(f.fit * 100)}%` : "?"}`).join(", ")}`,
              )
              .join("; ")}. Say which one you'd pick for the room and who it fits best, by name.`
          : (output.note ?? "Nothing found."),
      }),
    }),

    planNight: tool({
      ...toolDefs.planNight,
      execute: async (input) => {
        const empty = (note: string) => ({
          token: null,
          kind: "night" as const,
          title: `A night around ${input.area}`,
          city: input.city ?? null,
          startsAt: null,
          stops: [],
          route: null,
          shows: [],
          note,
        })
        const city = input.city ?? ctx.person.city ?? null
        const where = await locate(
          city ? `${input.area}, ${city}` : input.area,
          call("Find the area"),
        )
        if (!where) return empty(`I couldn't find ${input.area} on the map; try a bigger area.`)
        const tz = safeZone(ctx.tz)
        try {
          const { plan, shows } = await planNight({
            ownerId: ctx.userId,
            chatId: ctx.chatId,
            goers: await goersOf(ctx, input.everyone),
            point: { lat: where.lat, lon: where.lon },
            area: input.area,
            city,
            startsAt: zonedTime(input.date ?? todayIn(tz), input.time.padStart(5, "0"), tz),
            timeZone: tz,
            ctx: call(`A night around ${input.area}`),
          })
          return planCard(
            plan,
            shows.map((sh) => ({
              name: sh.name,
              url: sh.url,
              venue: sh.venue,
              localTime: sh.localTime?.slice(0, 5) ?? null,
              image: sh.image,
            })),
          )
        } catch (error) {
          return empty((error as Error).message)
        }
      },
    }),

    planTrip: tool({
      ...toolDefs.planTrip,
      execute: async (input) => {
        const tz = safeZone(ctx.tz)
        try {
          const { plan } = await planTrip({
            ownerId: ctx.userId,
            chatId: ctx.chatId,
            goers: await goersOf(ctx, input.everyone),
            city: input.city,
            days: input.days,
            date: input.date ?? todayIn(tz),
            timeZone: tz,
            ctx: call(`${input.days} days in ${input.city}`),
          })
          return planCard(plan, [])
        } catch (error) {
          return {
            token: null,
            kind: "trip" as const,
            title: `${input.days} days in ${input.city}`,
            city: input.city,
            startsAt: null,
            stops: [],
            route: null,
            shows: [],
            note: (error as Error).message,
          }
        }
      },
    }),

    findHotels: tool({
      ...toolDefs.findHotels,
      execute: async (input) => {
        const checkout = new Date(`${input.checkin}T12:00:00Z`)
        checkout.setUTCDate(checkout.getUTCDate() + input.nights)
        const base = {
          near: input.near,
          checkin: input.checkin,
          checkout: checkout.toISOString().slice(0, 10),
          guests: input.guests,
        }
        if (!hotelsOn())
          return { ...base, offers: [], note: "Hotel booking isn't switched on yet." }
        const city = input.city ?? ctx.person.city ?? null
        const where = await locate(
          city ? `${input.near}, ${city}` : input.near,
          call("Find the area"),
        )
        if (!where)
          return { ...base, offers: [], note: `I couldn't find ${input.near} on the map.` }
        try {
          const offers = await hotelsNear({
            lat: where.lat,
            lon: where.lon,
            radiusMeters: 4000,
            checkin: base.checkin,
            checkout: base.checkout,
            adults: input.guests,
            limit: 12,
          })
          // Best rated first among what's there, then cheaper.
          const sorted = offers
            .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.price.amount - b.price.amount)
            .slice(0, 6)
          return {
            ...base,
            offers: sorted.map((o) => ({
              offerId: o.offerId,
              hotelId: o.hotelId,
              name: o.name,
              photo: o.photo,
              address: o.address,
              stars: o.stars,
              rating: o.rating,
              price: o.price,
              refundable: o.refundable,
              room: o.room,
              board: o.board,
            })),
            note: sorted.length ? null : "No rooms free there for those dates.",
          }
        } catch (error) {
          return { ...base, offers: [], note: (error as Error).message }
        }
      },
    }),

    businessPlan: tool({
      ...toolDefs.businessPlan,
      execute: async (input, { toolCallId }) => {
        try {
          const b = await startBusiness(
            ctx.userId,
            {
              name: input.name,
              kind: input.kind,
              city: input.city,
              address: input.address,
              site: input.website,
              instagram: input.instagram,
              audience: input.audience,
              decision: input.decision,
            },
            { chatId: ctx.chatId, toolCallId },
          )
          return { businessId: b.id, runId: b.runId, name: b.name, note: null }
        } catch (error) {
          return { businessId: null, runId: null, name: input.name, note: (error as Error).message }
        }
      },
    }),

    postToX: tool({
      ...toolDefs.postToX,
      execute: async ({ text }) => {
        const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}`
        const own = await connectionOf(ctx.userId, "x").catch(() => null)
        if (own?.status !== "active")
          return { status: "link" as const, url: intent, handle: null, note: null }
        try {
          const posted = await xPost(secretOf(own), text)
          await noteConnection(own, { ok: true })
          await db.insert(schema.socialActions).values({
            userId: ctx.userId,
            platform: "x",
            kind: "post",
            target: posted.id,
            label: text.slice(0, 120),
            status: "done",
            url: posted.url,
          })
          return { status: "posted" as const, url: posted.url, handle: own.handle, note: null }
        } catch (error) {
          const e = error instanceof PlatformError ? error : null
          if (e)
            await noteConnection(own, {
              ok: false,
              error: e.message,
              status: e.expired ? (e.code === "locked" ? "locked" : "expired") : undefined,
            })
          // Their words aren't lost: the link posts the same text by hand.
          return {
            status: "failed" as const,
            url: intent,
            handle: own.handle,
            note: e?.message ?? "X didn't take the post",
          }
        }
      },
    }),

    callToBook: tool({
      ...toolDefs.callToBook,
      execute: async (input) => {
        if (!callsOn())
          return {
            bookingId: null,
            status: "unavailable" as const,
            phone: null,
            note: "Calling venues isn't switched on yet.",
          }
        const phone =
          (input.phone ? normalisePhone(input.phone) : null) ??
          (input.website ? await venuePhone(input.website).catch(() => null) : null)
        if (!phone)
          return {
            bookingId: null,
            status: "needs-number" as const,
            phone: null,
            note: `I couldn't find ${input.venue}'s number. What is it?`,
          }
        // A venue that asked not to be called by an AI is never rung again.
        const [blocked] = await db
          .select({ phone: schema.callBlocks.phone })
          .from(schema.callBlocks)
          .where(eq(schema.callBlocks.phone, phone))
        if (blocked)
          return {
            bookingId: null,
            status: "unavailable" as const,
            phone,
            note: `${input.venue} asked not to be called by an AI, so I won't. You can call them on ${phone}.`,
          }
        // Calls only within calling hours where the venue is (its number's country), else where
        // the person is; the time asked for is the venue's local time too.
        const tz = venueZone(phone) ?? safeZone(ctx.tz)
        const hour = Number(
          new Intl.DateTimeFormat("en-GB", {
            timeZone: tz,
            hour: "2-digit",
            hourCycle: "h23",
          }).format(new Date()),
        )
        if (hour < CALL_HOURS.from || hour >= CALL_HOURS.to)
          return {
            bookingId: null,
            status: "closed-hours" as const,
            phone,
            note: `It's outside calling hours where ${input.venue} is (${CALL_HOURS.from}am–9pm). Ask me again then.`,
          }
        const startsAt = zonedTime(input.date, input.time.padStart(5, "0"), tz)
        const when = startsAt.toLocaleString("en-GB", {
          timeZone: tz,
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
        })
        // A call costs real money and goes out in their name: it comes from a daily allowance.
        if (!(await charge(ctx.userId, ctx.guest, "calls")))
          return {
            bookingId: null,
            status: "unavailable" as const,
            phone,
            note: ctx.guest
              ? "Sign in to have Najimi call venues for you."
              : "That's all the calls for today. Ask me again tomorrow.",
          }
        const [booking] = await db
          .insert(schema.bookings)
          .values({
            ownerId: ctx.userId,
            chatId: ctx.chatId,
            kind: "table",
            provider: "call",
            status: "calling",
            title: `Table at ${input.venue}`,
            venue: input.venue,
            startsAt,
            party: input.party,
            data: { phone, notes: input.notes ?? null, when },
          })
          .returning()
        if (!booking)
          return {
            bookingId: null,
            status: "unavailable" as const,
            phone,
            note: "Couldn't start the call.",
          }
        try {
          const placed = await placeCall(phone, {
            bookingId: booking.id,
            venue: input.venue,
            guestName: ctx.person.name,
            party: input.party,
            when,
            notes: input.notes ?? null,
            callback: null,
          })
          await db
            .update(schema.bookings)
            .set({
              ref: { conversationId: placed.conversationId ?? "", callSid: placed.callSid ?? "" },
            })
            .where(eq(schema.bookings.id, booking.id))
          // If the call's webhook never comes, Najimi looks for the result itself.
          await enqueueAt(
            "bookingCheck",
            { bookingId: booking.id },
            new Date(Date.now() + 5 * 60_000),
          )
          return { bookingId: booking.id, status: "calling" as const, phone, note: null }
        } catch (error) {
          await refund(ctx.userId, "calls")
          await db
            .update(schema.bookings)
            .set({ status: "failed", note: (error as Error).message })
            .where(eq(schema.bookings.id, booking.id))
          return {
            bookingId: booking.id,
            status: "unavailable" as const,
            phone,
            note: (error as Error).message,
          }
        }
      },
    }),

    startPoll: tool({
      ...toolDefs.startPoll,
      execute: async (input) => {
        const [chat] = await db
          .select({ kind: schema.chats.kind })
          .from(schema.chats)
          .where(eq(schema.chats.id, ctx.chatId))
        if (!chat || chat.kind === "agent")
          throw new Error("Polls are for circles and DMs; just ask them here.")
        // A thing from Qloo shows its art on the card (and opens in the entity sheet).
        const ids = input.options.flatMap((o) => (o.qlooId ? [o.qlooId] : []))
        const found = ids.length
          ? await entities({ ids }, call("The poll's choices")).catch(() => null)
          : null
        const art = new Map((found?.data ?? []).map((e) => [e.entityId, e]))
        return startPollForNajimi({
          chatId: ctx.chatId,
          question: input.question,
          options: input.options.map((o) => {
            const thing = o.qlooId ? art.get(o.qlooId) : undefined
            return {
              label: o.label,
              qlooId: thing ? o.qlooId : null,
              image: thing?.image ?? null,
            }
          }),
        })
      },
    }),

    startGame: tool({
      ...toolDefs.startGame,
      execute: async (input) => {
        let subjectId: string | null = null
        let subject: { name: string; look: string | null } | null = null
        if (input.about && input.kind !== "blind" && input.kind !== "twins") {
          const [row] = await db
            .select({
              id: schema.user.id,
              name: schema.people.name,
              look: schema.people.look,
              visibility: schema.people.visibility,
            })
            .from(schema.user)
            .innerJoin(
              schema.people,
              and(eq(schema.people.ownerId, schema.user.id), eq(schema.people.isSelf, true)),
            )
            .where(eq(schema.user.username, input.about.replace(/^@/, "").toLowerCase()))
          // The same rule as their profile: a private taste is theirs; "friends" means you follow
          // each other.
          const seen =
            row &&
            (row.id === ctx.userId ||
              row.visibility === "public" ||
              (row.visibility === "friends" && (await followEachOther(ctx.userId, row.id))))
          if (row && !seen)
            return {
              token: null,
              kind: input.kind,
              title: TITLES[input.kind],
              subject: null,
              count: 0,
              note: "Their taste is private, so there's no game about them.",
            }
          if (row) {
            subjectId = row.id
            subject = { name: row.name, look: row.look }
          }
        }
        if (!subject && input.kind !== "twins")
          subject = { name: ctx.person.name, look: ctx.person.look }
        try {
          const round = await createRound(
            {
              kind: input.kind,
              createdBy: ctx.userId,
              subjectId: subjectId ?? ctx.userId,
              chatId: ctx.chatId,
            },
            call(`A game: ${TITLES[input.kind]}`),
          )
          if (ctx.chatId)
            await notifyGame(ctx.chatId, ctx.userId, {
              token: round.token,
              title: TITLES[input.kind],
            }).catch(() => null)
          return {
            token: round.token,
            kind: input.kind,
            title: TITLES[input.kind],
            subject: input.kind === "twins" ? null : subject,
            count: round.items.length,
            note: null,
          }
        } catch (error) {
          return {
            token: null,
            kind: input.kind,
            title: TITLES[input.kind],
            subject,
            count: 0,
            note: (error as Error).message,
          }
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.token
          ? `${output.title} is ready (shown as a card with a Play button and a challenge link). Invite the room in one playful sentence; you're playing too.`
          : `Couldn't start it: ${output.note}`,
      }),
    }),

    steerFeed: tool({
      ...toolDefs.steerFeed,
      execute: async (input) => {
        const person = ctx.person
        let retune = false
        let note: string | null = null
        // Categories: their dials, saved; the feed starts over on the new mix.
        const mix = (input.mix ?? []).map((m) => ({ category: m.category, level: m.level }))
        if (mix.length) {
          const [now] = await db
            .select({ feedMix: schema.people.feedMix })
            .from(schema.people)
            .where(eq(schema.people.id, person.id))
          const next = { ...(now?.feedMix ?? {}) }
          for (const m of mix) next[m.category] = m.level
          await db
            .update(schema.people)
            .set({ feedMix: next, feedCursor: null })
            .where(eq(schema.people.id, person.id))
        }
        // Something new to love: it joins their taste at a light weight, like a love from the feed.
        let loved: string | null = null
        let lovedThing: { qlooId: string; type: string; image: string | null } | null = null
        if (input.love) {
          const [{ n } = { n: 0 }] = await db
            .select({ n: count() })
            .from(schema.loves)
            .where(eq(schema.loves.personId, person.id))
          if (n >= TASTE.seedsMax)
            note = "Their taste is full; a love has to go before this one joins."
          else {
            const added = await db
              .insert(schema.loves)
              .values({
                personId: person.id,
                qlooId: input.love.qlooId,
                type: input.love.type,
                name: input.love.name,
                weight: FEED.loveWeight,
                source: "feed",
              })
              .onConflictDoNothing()
              .returning({ id: schema.loves.id })
            loved = input.love.name
            lovedThing = { qlooId: input.love.qlooId, type: input.love.type, image: null }
            retune ||= added.length > 0
          }
        }
        // Loves counting more or less.
        const weights: {
          name: string
          weight: number
          qlooId: string
          type: string
          image: string | null
        }[] = []
        if (input.weights?.length) {
          const rows = await db
            .select()
            .from(schema.loves)
            .where(eq(schema.loves.personId, person.id))
          for (const w of input.weights) {
            const row = rows.find((r) => r.name.toLowerCase() === w.loveName.toLowerCase())
            if (!row) continue
            await db
              .update(schema.loves)
              .set({ weight: w.weight })
              .where(eq(schema.loves.id, row.id))
            weights.push({
              name: row.name,
              weight: w.weight,
              qlooId: row.qlooId,
              type: row.type,
              image: row.imageUrl,
            })
            retune = true
          }
        }
        if (retune)
          await enqueueDebounced(
            "tasteRetune",
            { personId: person.id },
            FEED.retuneSeconds,
            person.id,
          )
        return { mix, loved, lovedThing, weights, note }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `Feed tuned (shown as a card). ${output.mix.length ? `Mix: ${output.mix.map((m) => `${m.category} ${m.level}`).join(", ")}. ` : ""}${output.loved ? `Added ${output.loved} to their taste. ` : ""}${output.weights.length ? `Weights: ${output.weights.map((w) => `${w.name} ${w.weight}`).join(", ")}. ` : ""}${output.note ?? ""} Confirm in one short sentence.`,
      }),
    }),

    askUser: toolDefs.askUser,
  }
}

export type ServerTools = ReturnType<typeof buildTools>
