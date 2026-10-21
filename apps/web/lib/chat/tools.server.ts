import "server-only"
import { type insightsInput, type Pick, toolDefs } from "@najimi/agent"
import { TASTE_DOMAINS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { Constraints } from "@najimi/db/schema"
import { enqueue } from "@najimi/jobs"
import { videoReady } from "@najimi/media"
import {
  audiences,
  compare,
  type ExploreInput,
  entities,
  explore,
  findTags,
  type Love,
  nameAreas,
  search,
} from "@najimi/qloo"
import { labelNotes, productsFor } from "@najimi/sources"
import { tool } from "ai"
import { and, asc, eq } from "drizzle-orm"
import type { z } from "zod"
import { type PersonRow, startTasteRun } from "@/lib/people"
import { charge, refund } from "./usage"

/** Who a turn acts for and on: the signed-in user, their chat, and everyone they keep a taste for. */
export type TurnContext = {
  userId: string
  guest: boolean
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
  `${i + 1}. ${p.name} [id ${p.qlooId}]${p.caption ? ` (${p.caption})` : ""}${p.details?.length ? ` known for ${p.details.join(", ")}` : ""}${p.because ? ` — because they love ${p.because.name}` : ""}${p.affinity != null ? ` — ${Math.round(p.affinity * 100)}% match` : ""}`

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

    makeImage: tool({
      ...toolDefs.makeImage,
      execute: async (input, { toolCallId }) => {
        const person = target(ctx, input.for)
        const n = input.variants ?? 2
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

    makeVideo: tool({
      ...toolDefs.makeVideo,
      execute: async (input, { toolCallId }) => {
        const base = { title: input.title, posterCreationId: null as string | null }
        if (!videoReady()) return { ...base, runId: null, creationId: null, note: "unavailable" }
        const [from] = await db
          .select()
          .from(schema.creations)
          .where(
            and(
              eq(schema.creations.id, input.fromCreationId),
              eq(schema.creations.ownerId, ctx.userId),
            ),
          )
        if (from?.status !== "ready" || from.kind !== "image")
          return {
            ...base,
            runId: null,
            creationId: null,
            note: "That image isn't ready to animate.",
          }
        if (!(await charge(ctx.userId, ctx.guest, "videos", 1)))
          return { ...base, runId: null, creationId: null, note: "allowance" }
        const [run] = await db
          .insert(schema.runs)
          .values({
            ownerId: ctx.userId,
            kind: "media",
            chatId: ctx.chatId,
            toolCallId,
            subject: { kind: "video" },
          })
          .returning({ id: schema.runs.id })
        const [job] = await db
          .insert(schema.mediaJobs)
          .values({
            ownerId: ctx.userId,
            chatId: ctx.chatId,
            toolCallId,
            kind: "video",
            provider: "fal",
            model: "",
            runId: run?.id,
            input: {
              prompt: input.motion,
              seconds: input.seconds ?? 6,
              audio: input.audio ?? false,
              sourceCreationId: from.id,
            },
          })
          .returning({ id: schema.mediaJobs.id })
        if (!run || !job) {
          await refund(ctx.userId, "videos", 1)
          return { ...base, runId: null, creationId: null, note: "failed" }
        }
        const [creation] = await db
          .insert(schema.creations)
          .values({
            ownerId: ctx.userId,
            mediaJobId: job.id,
            chatId: ctx.chatId,
            personId: from.personId,
            kind: "video",
            purpose: "film",
            title: input.title,
            prompt: input.motion,
            words: from.words,
            sourceCreationId: from.id,
          })
          .returning({ id: schema.creations.id })
        await enqueue("mediaGenerate", { jobId: job.id })
        return {
          ...base,
          posterCreationId: from.id,
          runId: run.id,
          creationId: creation?.id ?? null,
          note: null,
        }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.runId
          ? `The video "${output.title}" is rendering (1–3 minutes); the card shows progress. Don't wait for it.`
          : output.note === "unavailable"
            ? "Video isn't available on this server yet. Say so and offer more images."
            : output.note === "allowance"
              ? "Today's video allowance is used up."
              : `Not made: ${output.note}`,
      }),
    }),

    lightingPlan: tool({
      ...toolDefs.lightingPlan,
      execute: async (input, { toolCallId }) => ({
        planId: toolCallId,
        personName: target(ctx, input.for).name,
      }),
      toModelOutput: () => ({ type: "text", value: "Lighting plan shown as a card." }),
    }),

    findProducts: tool({
      ...toolDefs.findProducts,
      execute: async (input) => {
        const found = await entities(
          { ids: input.brandIds },
          call(`Brands for “${input.category}”`),
        ).catch(() => null)
        const brands = await Promise.all(
          (found?.data ?? []).map(async (b) => {
            const site =
              (b.properties as { official_site?: string }).official_site ?? b.handles.website
            const r = site
              ? await productsFor({ name: b.name, site }, input.category).catch(() => null)
              : null
            return {
              id: b.entityId,
              name: b.name,
              site: site ?? null,
              image: b.image,
              products: r?.products ?? [],
            }
          }),
        )
        return { title: input.title, category: input.category, brands }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `Get the look (shown as a card): ${output.brands
          .map(
            (b) =>
              `${b.name}: ${b.products.length ? b.products.map((p) => `${p.name}${p.price ? ` ${p.price} ${p.currency ?? ""}` : ""}`).join("; ") : "no product pages found, brand link shown"}`,
          )
          .join(" | ")}`,
      }),
    }),

    recipe: tool({
      ...toolDefs.recipe,
      execute: async (input, { toolCallId }) => {
        const person = target(ctx, input.for)
        const c = person.constraints
        const constraints = [
          ...(c.diet ?? []),
          ...(c.allergies ?? []).map((a) => `no ${a}`),
          ...(c.iddsi ? [`IDDSI ${c.iddsi}`] : []),
          ...(c.serveWarm ? ["lukewarm"] : []),
        ]
        return { recipeId: toolCallId, personName: person.name, constraints }
      },
      toModelOutput: () => ({ type: "text", value: "Recipe shown as a card." }),
    }),

    mealPlan: tool({
      ...toolDefs.mealPlan,
      execute: async (input, { toolCallId }) => ({
        planId: toolCallId,
        personName: target(ctx, input.for).name,
      }),
      toModelOutput: () => ({
        type: "text",
        value: "Meal plan and shopping list shown as a card.",
      }),
    }),

    medicationNotes: tool({
      ...toolDefs.medicationNotes,
      execute: async (input) => {
        const person = target(ctx, input.for)
        const notes = await Promise.all(input.medications.map((m) => labelNotes(m)))
        return { personName: person.name, notes }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: output.notes
          .map((n) =>
            n.found
              ? `${n.medication} (FDA label ${n.effective ?? ""}): ${n.excerpts.map((e) => e.text).join(" ") || "no food notes on the label"}`
              : `${n.medication}: no FDA label found`,
          )
          .join("\n"),
      }),
    }),

    savePerson: tool({
      ...toolDefs.savePerson,
      execute: async (input) => {
        const existing = ctx.people.find(
          (p) => p.name.toLowerCase() === input.name.trim().toLowerCase() && !p.isSelf,
        )
        if (existing)
          return { personId: existing.id, name: existing.name, loves: [], existed: true }
        const found = input.loveIds?.length
          ? ((
              await entities({ ids: input.loveIds }, call(`What ${input.name} loves`)).catch(
                () => null,
              )
            )?.data ?? [])
          : []
        const [row] = await db
          .insert(schema.people)
          .values({
            ownerId: ctx.userId,
            name: input.name.trim(),
            city: input.city ?? ctx.person.city,
            ageBand: input.ageBand ?? null,
            constraints: {
              ...input.constraints,
              notes: [
                ...(input.relation ? [input.relation] : []),
                ...(input.constraints?.notes ?? []),
              ],
            },
          })
          .returning()
        if (!row) throw new Error("Couldn't save the profile")
        const loves = found.filter((e) => e.type)
        if (loves.length) {
          await db
            .insert(schema.loves)
            .values(
              loves.map((e) => ({
                personId: row.id,
                qlooId: e.entityId,
                type: e.type ?? "",
                name: e.name,
                imageUrl: e.image,
                weight: 5,
              })),
            )
            .onConflictDoNothing()
          await startTasteRun(ctx.userId, row.id)
        }
        ctx.people.push(row)
        return { personId: row.id, name: row.name, loves: loves.map((e) => e.name), existed: false }
      },
      toModelOutput: ({ output }) => ({
        type: "text",
        value: `${output.existed ? "Already kept" : "Saved"}: ${output.name}, id ${output.personId}${output.loves.length ? `, loves ${output.loves.join(", ")} (taste computing)` : ""}. Use this id in for.`,
      }),
    }),

    tasteBrief: tool({
      ...toolDefs.tasteBrief,
      execute: async (input) => {
        const person = target(ctx, input.for)
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

    askUser: toolDefs.askUser,

    remember: tool({
      ...toolDefs.remember,
      execute: async (input) => {
        const person = target(ctx, input.for)
        const c: Constraints = { ...person.constraints }
        const value = input.value.trim()
        // "None" is an answer, not a fact: nothing to keep for a diet, an allergy or a medication.
        const nothing =
          /^(none|no|nothing|n\/a|aucune?|rien|non|ninguno|nenhum|لا|لا يوجد)\b/i.test(value)
        if (nothing && ["diet", "allergy", "medication"].includes(input.kind))
          return { personId: person.id, personName: person.name, kind: input.kind, value }
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
