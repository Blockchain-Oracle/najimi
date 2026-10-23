import { locate } from "@najimi/booking/plan"
import { BUSINESS } from "@najimi/config"
import { db, schema } from "@najimi/db"
import type { BusinessMove, BusinessReport, BusinessThing, StoredPick } from "@najimi/db/schema"
import { enqueue } from "@najimi/jobs"
import { emit, publish, setRunStatus, topic } from "@najimi/live"
import {
  type CallContext,
  compare,
  demographics,
  explore,
  findTags,
  type Love,
  nameAreas,
  profileInsights,
  sceneOf,
  search,
  type TasteItem,
  tasteTags,
} from "@najimi/qloo"
import { fetchPublic } from "@najimi/sources"
import { generateObject } from "ai"
import { and, count, eq, gte } from "drizzle-orm"
import { z } from "zod"
import { agentModel, brainModelId, costOf, lightModelId } from "../models"
import { publishMessage, toUI } from "./room"

/*
 * Business mode (W19): a business's plan, built from Qloo the way a consultant would. Read the
 * site; find the business in Qloo (or its nearest comparables); read what its fans love across
 * every kind of thing, their words and age lean; where they cluster in the city; the street's own
 * scene and how the business differs from it; what's rising around it (audience_growth). Then the
 * brain model writes the plan from that evidence only, every idea citing the Qloo results it
 * stands on. Each step streams to the run, so the owner watches it work.
 */

export type BusinessRow = typeof schema.businesses.$inferSelect

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "")

const thing = (i: TasteItem, callId: string | null): BusinessThing => ({
  qlooId: i.entityId,
  name: i.name,
  type: i.type ?? "",
  image: i.image,
  caption: i.caption,
  fit: i.affinity,
  callId,
})

const fromPick = (p: StoredPick): BusinessThing => ({
  qlooId: p.qlooId,
  name: p.name,
  type: p.type,
  image: p.image,
  caption: p.caption,
  fit: p.affinity ?? null,
  callId: p.callId ?? null,
})

async function logCall(
  userId: string,
  purpose: string,
  modelId: string,
  started: number,
  usage: unknown,
) {
  const u = usage as { inputTokens?: number; outputTokens?: number }
  await db
    .insert(schema.llmCalls)
    .values({
      userId,
      purpose,
      provider: modelId.split(":")[0],
      model: modelId,
      inputTokens: u.inputTokens ?? null,
      outputTokens: u.outputTokens ?? null,
      ms: Date.now() - started,
      costUsd: costOf(modelId, { input: u.inputTokens, output: u.outputTokens }),
    })
    .catch(() => undefined)
}

// ── The site ───────────────────────────────────────────────────────────────────────────────

const siteShape = z.object({
  title: z.string().max(120).nullable(),
  offer: z
    .array(z.string().max(80))
    .max(14)
    .describe("What they sell or serve: dishes, drinks, products, services, nights."),
  vibe: z
    .array(z.string().max(40))
    .max(8)
    .describe("A few words for how they describe themselves."),
  address: z.string().max(160).nullable().describe("Their street address if the page gives it."),
})

/** The page's own words (tags, scripts and styles stripped) and any structured data on it. */
function wordsOf(html: string) {
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1]?.trim() ?? "")
    .join("\n")
    .slice(0, 3000)
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? ""
  const description =
    /<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']+)/i.exec(
      html,
    )?.[1] ?? ""
  const text = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BUSINESS.siteChars)
  return `Title: ${title}\nDescription: ${description}\nStructured data: ${ld}\nPage: ${text}`
}

async function readSite(url: string, userId: string) {
  const page = await fetchPublic(url, { accept: "text/html" }).catch(() => null)
  if (!page?.text) return null
  const modelId = lightModelId()
  const started = Date.now()
  const read = await generateObject({
    model: agentModel(modelId),
    schema: siteShape,
    prompt: `This is a business's own web page. Say what it offers and how it describes itself, only from the page.\n\n${wordsOf(page.text)}`,
    maxOutputTokens: 700,
    providerOptions: { openai: { reasoningEffort: "low" } },
  }).catch(() => null)
  if (!read) return null
  await logCall(userId, "business-site", modelId, started, read.usage)
  return read.object
}

// ── The plan ───────────────────────────────────────────────────────────────────────────────

const KINDS = ["menu", "music", "night", "stock", "partner", "space", "service"] as const

const planShape = z.object({
  people: z
    .string()
    .max(200)
    .describe(
      "One sentence, at most 140 characters: who its people are, in their own taste terms.",
    ),
  moves: z
    .array(
      z.object({
        kind: z.enum(KINDS),
        title: z
          .string()
          .max(90)
          .describe("The move itself in at most eight words (60 characters). No colon."),
        why: z
          .string()
          .max(220)
          .describe("One sentence, at most 140 characters, naming what its people love."),
        evidence: z.array(z.string()).min(1).max(4).describe("Qloo ids from the evidence."),
        next: z.object({
          type: z
            .enum(["post", "invite", "plan", "play"])
            .describe(
              "The one thing to do next: post (a post to put out), invite (message a partner), plan (ask Najimi to plan the night or event), play (hear the set: the move's evidence includes artists).",
            ),
          text: z
            .string()
            .max(320)
            .describe(
              "post: the post in the business's voice. invite: a short, warm first message to the partner from the owner. plan: what to ask Najimi to plan, in the owner's words (what, which day, for whom). play: one line on when the set plays.",
            ),
          partner: z
            .string()
            .nullable()
            .describe("invite only: the Qloo id of who to invite, from the evidence. Else null."),
        }),
      }),
    )
    .min(1)
    .max(3)
    .describe("Exactly three moves for this week, the strongest first, each a different kind."),
  partners: z
    .array(z.object({ qlooId: z.string(), why: z.string().max(220) }))
    .max(4)
    .describe(
      "Brands, artists or places from the evidence to team up with; why in 140 characters.",
    ),
  posts: z.array(z.string().max(280)).max(3).describe("Posts in the business's voice."),
  targets: z
    .array(z.object({ area: z.string().max(60), why: z.string().max(220) }))
    .max(3)
    .describe("Areas from the evidence to reach people in; why in 140 characters."),
})

async function writePlan(b: BusinessRow, report: Omit<BusinessReport, "plan" | "builtAt">) {
  const list = (items: BusinessThing[]) =>
    items.map((i) => `${i.name} [${i.qlooId}]${i.caption ? ` (${i.caption})` : ""}`).join("; ")
  const evidence = [
    `Business: ${b.name}, a ${b.kind}${b.city ? ` in ${b.city}` : ""}.`,
    b.audienceGuess ? `The owner thinks their customers are: ${b.audienceGuess}.` : "",
    b.decision ? `The owner is deciding: ${b.decision}.` : "",
    b.links.instagram ? `Its Instagram: @${b.links.instagram}.` : "",
    report.site
      ? `Their site offers: ${report.site.offer.join(", ") || "—"}; they call themselves ${report.site.vibe.join(", ") || "—"}.`
      : "",
    report.match
      ? `Qloo knows the business itself: ${report.match.name} [${report.match.qlooId}].`
      : `Qloo doesn't know it yet; its fans are read from comparable places: ${list(report.comparables)}.`,
    ...Object.entries(report.fans).map(
      ([kind, items]) => `Its fans also love (${kind.replace("urn:entity:", "")}): ${list(items)}.`,
    ),
    report.words.length
      ? `Their taste in words: ${report.words.map((w) => w.name).join(", ")}.`
      : "",
    report.lean
      ? `Age lean: ${JSON.stringify(report.lean.age)}; gender lean: ${JSON.stringify(report.lean.gender)}.`
      : "",
    report.areas.length
      ? `Where they cluster in the city: ${report.areas.map((a) => a.name).join(", ")}.`
      : "",
    report.scene
      ? `The street around it (${report.scene.area ?? "its area"}): words ${report.scene.words.join(", ")}; artists ${list(report.scene.artists)}; brands ${list(report.scene.brands)}; places ${list(report.scene.places)}.`
      : "",
    report.compare
      ? `Shared with the street: ${report.compare.shared.join(", ") || "—"}. Only its fans: ${report.compare.theirsOnly.join(", ") || "—"}. Only the street: ${report.compare.sceneOnly.join(", ") || "—"}.`
      : "",
    report.rising.length
      ? `Rising around it among its fans: ${report.rising.map((r) => `${r.name} [${r.qlooId}] +${r.growth.toFixed(2)}`).join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
  const modelId = brainModelId()
  const started = Date.now()
  const read = await generateObject({
    model: agentModel(modelId),
    schema: planShape,
    system:
      "You are a sharp, practical consultant for small businesses. Write a plan only from the evidence given (Qloo's cultural taste data); never invent facts, names or numbers. Every move and partner must cite Qloo ids that appear in the evidence. Be concrete: a dish, a drink, a night, an artist to play, a brand to team up with, a post to make. Keep it short: an owner reads the whole plan on one phone screen, and each move ends in one thing they can do today. Plain words, no buzzwords.",
    prompt: evidence,
    maxOutputTokens: 1800,
    providerOptions: { openai: { reasoningEffort: "low" } },
  })
  await logCall(b.ownerId, "business-plan", modelId, started, read.usage)
  const things = new Map<string, BusinessThing>()
  for (const list of [
    ...Object.values(report.fans),
    report.comparables,
    report.match ? [report.match] : [],
    report.scene ? [...report.scene.artists, ...report.scene.brands, ...report.scene.places] : [],
    report.rising,
  ])
    for (const i of list) things.set(i.qlooId, i)
  const areaNames = new Set(report.areas.map((a) => a.name.toLowerCase()))
  // Models sometimes trail a stray ";" or "*" when they hit a length; a sentence ends cleanly.
  const tidy = (text: string) => text.replace(/[\s;:*,—-]+$/, "").replace(/([^.!?])$/, "$1.")
  const isArtist = (id: string) => things.get(id)?.type === "urn:entity:artist"
  const moves: BusinessMove[] = read.object.moves.flatMap((m) => {
    const evidence = m.evidence.filter((id) => things.has(id))
    if (!evidence.length) return []
    const partner = m.next.partner && things.has(m.next.partner) ? m.next.partner : null
    // An action the evidence can't carry becomes a plan for Najimi: an invite needs someone to
    // invite, a set needs artists to play.
    const type =
      (m.next.type === "invite" && !partner) || (m.next.type === "play" && !evidence.some(isArtist))
        ? "plan"
        : m.next.type
    const text = type === m.next.type ? m.next.text.trim() : `Plan this at ${b.name}: ${m.title}`
    return [
      {
        kind: m.kind,
        title: m.title.replace(/[.:]+$/, "").trim(),
        why: tidy(m.why),
        evidence,
        next: { type, text, partner: type === "invite" ? partner : null },
      },
    ]
  })
  return {
    summary: tidy(read.object.people),
    moves,
    partners: read.object.partners
      .filter((p) => things.has(p.qlooId))
      .map((p) => ({ ...p, why: tidy(p.why) })),
    posts: read.object.posts,
    targets: read.object.targets.filter((tg) => areaNames.has(tg.area.toLowerCase())),
  }
}

// ── Starting one ───────────────────────────────────────────────────────────────────────────

export type BusinessInput = {
  name: string
  kind: string
  city?: string | null
  address?: string | null
  site?: string | null
  instagram?: string | null
  audience?: string | null
  decision?: string | null
}

/** Opens a business and starts its plan (a visible run); a few a day per owner. */
export async function startBusiness(
  ownerId: string,
  input: BusinessInput,
  from?: { chatId: string; toolCallId?: string },
) {
  const [made] = await db
    .select({ n: count() })
    .from(schema.businesses)
    .where(
      and(
        eq(schema.businesses.ownerId, ownerId),
        gte(schema.businesses.createdAt, new Date(Date.now() - 86_400_000)),
      ),
    )
  if ((made?.n ?? 0) >= BUSINESS.perDay) throw new Error("That's all the plans for today.")
  const site = input.site?.trim()
    ? /^https?:\/\//i.test(input.site.trim())
      ? input.site.trim()
      : `https://${input.site.trim()}`
    : null
  const [run] = await db
    .insert(schema.runs)
    .values({
      ownerId,
      kind: "business",
      subject: {},
      chatId: from?.chatId ?? null,
      toolCallId: from?.toolCallId ?? null,
    })
    .returning({ id: schema.runs.id })
  const [b] = await db
    .insert(schema.businesses)
    .values({
      ownerId,
      name: input.name.trim(),
      kind: input.kind.trim(),
      city: input.city?.trim() || null,
      address: input.address?.trim() || null,
      links: { site, instagram: input.instagram?.trim().replace(/^@/, "") || null },
      audienceGuess: input.audience?.trim() || null,
      decision: input.decision?.trim() || null,
      runId: run?.id ?? null,
    })
    .returning()
  if (!b) throw new Error("Couldn't open the business")
  if (run)
    await db
      .update(schema.runs)
      .set({ subject: { businessId: b.id } })
      .where(eq(schema.runs.id, run.id))
  await enqueue("businessBuild", { businessId: b.id }, b.id)
  return b
}

/** Builds it again (the owner asked, or something about it changed). */
export async function rebuildBusiness(b: BusinessRow) {
  const [run] = await db
    .insert(schema.runs)
    .values({ ownerId: b.ownerId, kind: "business", subject: { businessId: b.id } })
    .returning({ id: schema.runs.id })
  await db
    .update(schema.businesses)
    .set({ runId: run?.id ?? null, status: "building", error: null, updatedAt: new Date() })
    .where(eq(schema.businesses.id, b.id))
  await enqueue("businessBuild", { businessId: b.id }, b.id)
  return run?.id ?? null
}

/** Najimi's read in the chat the plan was asked for in: where its people are, the first move. */
async function tellInChat(b: BusinessRow, runId: string, report: BusinessReport) {
  const [run] = await db
    .select({ chatId: schema.runs.chatId })
    .from(schema.runs)
    .where(eq(schema.runs.id, runId))
  if (!run?.chatId) return
  const first = report.plan?.moves?.[0] ?? report.plan?.ideas?.[0]
  const where = report.areas.slice(0, 2).map((a) => a.name)
  const text = [
    `${b.name}'s plan is ready.`,
    where.length ? `Its people cluster most in ${where.join(" and ")}.` : "",
    first ? `I'd start with this: **${first.title}**. ${first.why}` : "",
    `[Open the plan](/business/${b.id})`,
  ]
    .filter(Boolean)
    .join(" ")
  const [row] = await db
    .insert(schema.messages)
    .values({
      id: `msg_biz_${b.id.slice(0, 8)}_${Date.now().toString(36)}`,
      chatId: run.chatId,
      role: "assistant",
      status: "done",
      parts: [{ type: "text", text }],
      metadata: { businessId: b.id },
    })
    .returning()
  if (row) {
    await publishMessage(run.chatId, toUI(row))
    await db
      .update(schema.chats)
      .set({ lastActiveAt: new Date() })
      .where(eq(schema.chats.id, run.chatId))
  }
}

// ── The build ──────────────────────────────────────────────────────────────────────────────

type Step = "site" | "match" | "fans" | "areas" | "scene" | "rising" | "plan"

export async function buildBusiness(businessId: string, opts: { notify?: boolean } = {}) {
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, businessId))
  if (!b) return
  const runId = b.runId
  const ctx: CallContext = { userId: b.ownerId, purpose: `Business plan: ${b.name}` }
  const step = (id: Step, status: "running" | "done" | "skipped", note?: string | null) =>
    runId ? emit(runId, "step", { step: id, status, note: note ?? null }) : Promise.resolve()
  if (runId) await setRunStatus(runId, "running")
  const calls: string[] = []
  const keep = (callId: string | null | undefined) => {
    if (callId) calls.push(callId)
    return callId ?? null
  }

  try {
    // 1. What the site says (and where it is, if the owner didn't say).
    let site: BusinessReport["site"] = null
    if (b.links.site) {
      await step("site", "running")
      const read = await readSite(b.links.site, b.ownerId)
      site = read ? { title: read.title, offer: read.offer, vibe: read.vibe } : null
      if (read?.address && !b.address)
        await db
          .update(schema.businesses)
          .set({ address: read.address })
          .where(eq(schema.businesses.id, b.id))
      await step("site", "done", read ? `${read.offer.length} things on offer` : "couldn't read it")
    } else await step("site", "skipped")

    // 2. Find it in Qloo, near where it is; otherwise the closest comparables.
    await step("match", "running")
    let lat = b.lat
    let lon = b.lon
    if (lat == null || lon == null) {
      const query = [b.address, b.city].filter(Boolean).join(", ")
      const hit = query ? await locate(query, ctx).catch(() => null) : null
      if (hit) {
        lat = hit.lat
        lon = hit.lon
        await db.update(schema.businesses).set({ lat, lon }).where(eq(schema.businesses.id, b.id))
      }
    }
    const near = lat != null && lon != null ? { lat, lon } : null
    const found = await search(
      {
        query: near ? b.name : `${b.name} ${b.city ?? ""}`.trim(),
        types: ["urn:entity:place", "urn:entity:brand"],
        near: near ?? undefined,
        radiusMiles: near ? BUSINESS.matchRadiusMiles : undefined,
        take: 8,
      },
      ctx,
    ).catch(() => null)
    keep(found?.call.callId)
    const own = found?.data.find((i) => norm(i.name) === norm(b.name)) ?? null
    const match = own ? thing(own, found?.call.callId ?? null) : null
    let comparables: BusinessThing[] = []
    if (!match && near) {
      const tags = await findTags({ query: b.kind, take: 8 }, ctx).catch(() => null)
      keep(tags?.call.callId)
      const genre =
        tags?.data.find((tg) => (tg.id ?? tg.tag_id ?? "").startsWith("urn:tag:genre:place"))?.id ??
        tags?.data.find((tg) => (tg.id ?? tg.tag_id ?? "").includes(":place"))?.id ??
        null
      if (genre) {
        const peers = await explore(
          {
            filterType: "urn:entity:place",
            filter: {
              point: { ...near, radiusMeters: BUSINESS.comparableRadiusMeters },
              tags: [genre],
            },
            take: BUSINESS.comparables,
          },
          [],
          { ...ctx, purpose: `Places like ${b.name} nearby` },
        ).catch(() => null)
        if (peers?.kind === "entities") {
          keep(peers.callId)
          comparables = peers.picks.map(fromPick)
        }
      }
    }
    const seeds: Love[] = match
      ? [{ qlooId: match.qlooId, name: match.name, weight: 10 }]
      : comparables.map((c) => ({ qlooId: c.qlooId, name: c.name, weight: 6 }))
    await step(
      "match",
      seeds.length ? "done" : "skipped",
      match
        ? match.name
        : comparables.length
          ? `${comparables.length} places like it`
          : "not found",
    )
    if (!seeds.length)
      throw new Error(
        "Qloo couldn't find this business or places like it. Add its address or website and try again.",
      )
    const seedIds = seeds.map((s) => s.qlooId)

    // 3. Its fans: what else they love, their words, their age lean.
    await step("fans", "running")
    const [byKind, words, lean] = await Promise.all([
      Promise.all(
        BUSINESS.kinds.map((filterType) =>
          profileInsights(
            seeds,
            {
              filterType,
              take: BUSINESS.perKind,
              withImage: true,
              exclude: seedIds,
              ...(filterType === "urn:entity:place" && b.city ? { city: b.city } : {}),
            },
            { ...ctx, purpose: `What ${b.name}'s fans love` },
          )
            .then((r) => [filterType, r.items.map((i) => thing(i, keep(r.call.callId)))] as const)
            .catch(() => [filterType, [] as BusinessThing[]] as const),
        ),
      ),
      tasteTags({ signalEntities: seedIds, take: 16 }, ctx)
        .then((r) => {
          keep(r.call.callId)
          return r.data.map((tg) => ({ name: tg.name.trim(), score: tg.query?.affinity ?? null }))
        })
        .catch(() => []),
      demographics({ signalEntities: seedIds }, ctx)
        .then((r) => {
          keep(r.call.callId)
          const rows = r.data
          if (!rows.length) return null
          const avg = (pick: (row: (typeof rows)[number]) => Record<string, number>) => {
            const out: Record<string, number> = {}
            for (const row of rows)
              for (const [k, v] of Object.entries(pick(row)))
                out[k] = (out[k] ?? 0) + v / rows.length
            return out
          }
          return { age: avg((row) => row.age), gender: avg((row) => row.gender) }
        })
        .catch(() => null),
    ])
    const fans = Object.fromEntries(byKind.filter(([, items]) => items.length))
    await step("fans", "done", `${Object.values(fans).flat().length} things they love`)

    // 4. Where they cluster in its city.
    let areas: BusinessReport["areas"] = []
    let cells: BusinessReport["cells"] = []
    if (b.city) {
      await step("areas", "running")
      const signal = { entities: seeds.map((s) => ({ id: s.qlooId, weight: s.weight })) }
      const heat = await explore(
        { filterType: "urn:heatmap", signal, filter: { city: b.city } },
        seeds,
        { ...ctx, purpose: `Where ${b.name}'s people are` },
      ).catch(() => null)
      if (heat?.kind === "heatmap") {
        keep(heat.callId)
        const sorted = [...heat.points].sort((x, y) => y.affinity - x.affinity)
        cells = sorted
          .slice(0, BUSINESS.cells)
          .map((p) => [p.geohash, Math.round(p.affinity * 1000) / 1000] as [string, number])
        areas = (
          await nameAreas(sorted, signal, seeds, ctx, BUSINESS.areas, b.city).catch(() => [])
        ).map((a) => ({ name: a.name, lat: a.lat, lon: a.lon, affinity: a.affinity }))
      }
      await step("areas", "done", areas.map((a) => a.name).join(", ") || null)
    } else await step("areas", "skipped")

    // 5. The street's own scene, and how the business differs from it.
    let scene: BusinessReport["scene"] = null
    let compared: BusinessReport["compare"] = null
    if (near) {
      await step("scene", "running")
      const s = await sceneOf({ ...near, radiusMeters: BUSINESS.aroundMeters }, ctx).catch(
        () => null,
      )
      if (s) {
        calls.push(...s.callIds)
        scene = {
          area: areas[0]?.name ?? null,
          words: s.words.slice(0, 10).map((w) => w.name),
          artists: s.artists.slice(0, 6).map(fromPick),
          brands: s.brands.slice(0, 6).map(fromPick),
          places: s.places
            .filter((p) => !seedIds.includes(p.qlooId))
            .slice(0, 6)
            .map(fromPick),
        }
        const streetIds = s.places
          .slice(0, 5)
          .map((p) => p.qlooId)
          .filter((id) => !seedIds.includes(id))
        if (streetIds.length) {
          const c = await compare({ a: seedIds, b: streetIds }, ctx).catch(() => null)
          if (c) {
            keep(c.call.callId)
            compared = {
              shared: c.data.shared.slice(0, 8).map((x) => x.name),
              theirsOnly: c.data.onlyA.slice(0, 8),
              sceneOnly: c.data.onlyB.slice(0, 8),
            }
          }
        }
      }
      await step("scene", "done", scene?.words.slice(0, 3).join(", ") || null)
    } else await step("scene", "skipped")

    // 6. What's rising around it among its fans (Qloo measures audience growth for places).
    let rising: BusinessReport["rising"] = []
    if (near) {
      await step("rising", "running")
      const around = await profileInsights(
        seeds,
        {
          filterType: "urn:entity:place",
          take: 25,
          exclude: seedIds,
          extra: {
            "filter.location": `POINT(${near.lon} ${near.lat})`,
            "filter.location.radius": BUSINESS.aroundMeters,
          },
        },
        { ...ctx, purpose: `What's rising around ${b.name}` },
      ).catch(() => null)
      if (around) {
        const callId = keep(around.call.callId)
        rising = around.items
          .filter((i) => (i.growth ?? 0) > 0)
          .sort((x, y) => (y.growth ?? 0) - (x.growth ?? 0))
          .slice(0, 6)
          .map((i) => ({ ...thing(i, callId), growth: i.growth ?? 0 }))
      }
      await step("rising", "done", rising.length ? `${rising.length} rising` : "nothing rising yet")
    } else await step("rising", "skipped")

    // 7. The plan, written from that evidence only.
    await step("plan", "running")
    const base = {
      site,
      match,
      comparables,
      fans,
      words,
      lean,
      areas,
      cells,
      scene,
      compare: compared,
      rising,
      calls,
    }
    const plan = await writePlan(b, base).catch((e) => {
      console.error("[business] plan", e)
      return null
    })
    await step("plan", plan ? "done" : "skipped", plan ? `${plan.moves.length} moves` : null)
    const report: BusinessReport = {
      ...base,
      plan,
      calls: [...new Set(calls)],
      builtAt: new Date().toISOString(),
    }
    await db
      .update(schema.businesses)
      .set({ report, status: "ready", error: null, updatedAt: new Date() })
      .where(eq(schema.businesses.id, b.id))
    if (runId) await setRunStatus(runId, "done")
    if (opts.notify === false) return
    if (runId) await tellInChat(b, runId, report)
    const [note] = await db
      .insert(schema.notifications)
      .values({
        userId: b.ownerId,
        kind: "booking",
        data: { text: `${b.name}'s plan is ready`, businessId: b.id },
      })
      .returning({ id: schema.notifications.id })
    await publish(topic.user(b.ownerId), "notification", { id: note?.id, kind: "booking" })
  } catch (error) {
    const message = (error as Error).message
    await db
      .update(schema.businesses)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(schema.businesses.id, b.id))
    if (runId) await setRunStatus(runId, "failed", message)
  }
}
