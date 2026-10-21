import "server-only"
import { type insightsInput, type Pick, toolDefs } from "@najimi/agent"
import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { Constraints } from "@najimi/db/schema"
import {
  audiences,
  compare,
  type ExploreInput,
  explore,
  findTags,
  type Love,
  nameAreas,
  search,
} from "@najimi/qloo"
import { tool } from "ai"
import { and, asc, eq } from "drizzle-orm"
import type { z } from "zod"
import type { PersonRow } from "@/lib/people"

/** Who a turn acts for and on: the signed-in user, their chat, and everyone they keep a taste for. */
export type TurnContext = {
  userId: string
  chatId: string
  /** The chat's own person (tools default to them). */
  person: PersonRow
  people: PersonRow[]
}

type InsightsInput = z.infer<typeof insightsInput>

const TYPE_OF = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.key, d.type])) as Record<
  string,
  string
>

/** The person a tool call is for: one of the user's own people, or the chat's person. */
const target = (ctx: TurnContext, id: string | undefined): PersonRow =>
  (id && ctx.people.find((p) => p.id === id)) || ctx.person

async function lovesOf(personId: string): Promise<Love[]> {
  const rows = await db
    .select()
    .from(schema.loves)
    .where(eq(schema.loves.personId, personId))
    .orderBy(asc(schema.loves.createdAt))
  return rows.map((r) => ({ qlooId: r.qlooId, name: r.name, weight: r.weight }))
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
  `${i + 1}. ${p.name} [id ${p.qlooId}]${p.caption ? ` (${p.caption})` : ""}${p.because ? ` — because they love ${p.because.name}` : ""}${p.affinity != null ? ` — ${Math.round(p.affinity * 100)}% match` : ""}`

const ENTITY_ASKS = new Set(TASTE_DOMAINS.map((d) => d.key as string))
const FILTER_TYPE: Record<string, string> = {
  tags: "urn:tag",
  heatmap: "urn:heatmap",
  demographics: "urn:demographics",
}

/** The tools of one turn, each bound to the user and their people. */
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
        const person = target(ctx, input.for)
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

        const request: ExploreInput = {
          filterType,
          signal: {
            entities,
            tags: input.signal?.tags,
            age: input.signal?.age,
            gender: input.signal?.gender,
            audiences: input.signal?.audiences,
            location: input.signal?.location,
          },
          filter: {
            ...input.filter,
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
        const side = async (s: { personId?: string; entityIds?: string[] }) => {
          if (s.entityIds?.length) return s.entityIds
          const p = s.personId ? ctx.people.find((x) => x.id === s.personId) : ctx.person
          return p ? (await lovesOf(p.id)).map((l) => l.qlooId) : []
        }
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

    tasteBrief: tool({
      ...toolDefs.tasteBrief,
      execute: async (input) => {
        const person = target(ctx, input.for)
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

    askUser: toolDefs.askUser,

    remember: tool({
      ...toolDefs.remember,
      execute: async (input) => {
        const person = target(ctx, input.for)
        const c: Constraints = { ...person.constraints }
        const value = input.value.trim()
        const add = (list: string[] | undefined) => [...new Set([...(list ?? []), value])]
        switch (input.kind) {
          case "diet":
            c.diet = add(c.diet)
            break
          case "allergy":
            c.allergies = add(c.allergies)
            break
          case "medication":
            c.medications = add(c.medications)
            break
          case "texture": {
            const level = Number.parseInt(value, 10)
            if (level >= 3 && level <= 7) c.iddsi = level
            break
          }
          case "serveWarm":
            c.serveWarm = !/^(no|false|non|لا)$/i.test(value)
            break
          case "budget":
            c.budget = value
            break
          default:
            c.notes = add(c.notes)
        }
        await db
          .update(schema.people)
          .set({ constraints: c })
          .where(and(eq(schema.people.id, person.id), eq(schema.people.ownerId, ctx.userId)))
        person.constraints = c
        return { personId: person.id, personName: person.name, kind: input.kind, value }
      },
    }),
  }
}

export type ServerTools = ReturnType<typeof buildTools>
