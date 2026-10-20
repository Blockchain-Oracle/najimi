import { ClaudeNotConfigured, claudeConfigured } from "@najimi/claude"
import { db, schema } from "@najimi/db"
import { emit, setRunStatus } from "@najimi/live"
import { qlooConfigured, type Resolution, resolveBusiness, type TasteItem } from "@najimi/qloo"
import {
  basicProfile,
  extractProfile,
  geocode,
  readSite,
  SiteUnreadable,
  wikidataId,
} from "@najimi/site"
import { and, eq } from "drizzle-orm"

/*
 * Reading a pasted business, step by step, each step a live event the setup page shows as it lands
 * (plan S02, F1/F2/F5): read the site → what it says about itself → where it is → who it is in
 * Qloo. Ends "ready" (matched, or found through comparables), or "confirm" when several Qloo
 * entries could be it and the owner must say which (SAFE_USE: show matches when ambiguous).
 */

type Status = (typeof schema.businessStatus.enumValues)[number]

async function setBusiness(id: string, values: Partial<typeof schema.businesses.$inferInsert>) {
  await db.update(schema.businesses).set(values).where(eq(schema.businesses.id, id))
}

function matchRow(
  businessId: string,
  role: "own" | "candidate" | "comparable",
  item: TasteItem,
  extra: { evidence?: string[]; route?: string; callId?: string } = {},
) {
  return {
    businessId,
    role,
    entityId: item.entityId,
    name: item.name,
    data: item as unknown as Record<string, unknown>,
    evidence: extra.evidence ?? [],
    route: extra.route ?? null,
    callId: extra.callId ?? null,
  }
}

async function saveResolution(businessId: string, resolution: Resolution) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.qlooMatches).where(eq(schema.qlooMatches.businessId, businessId))
    const rows = []
    if (resolution.own)
      rows.push(
        matchRow(businessId, "own", resolution.own.item, { evidence: resolution.own.evidence }),
      )
    for (const c of resolution.candidates)
      if (c.item.entityId !== resolution.own?.item.entityId)
        rows.push(matchRow(businessId, "candidate", c.item, { evidence: c.evidence }))
    for (const item of resolution.comparables)
      rows.push(matchRow(businessId, "comparable", item, { route: resolution.comparablesRoute }))
    if (rows.length) await tx.insert(schema.qlooMatches).values(rows)
  })
}

export async function businessSetup(businessId: string, runId: string): Promise<void> {
  const [business] = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
  if (!business) return
  const step = (key: string, label: string, data: Record<string, unknown> = {}) =>
    emit(runId, "step", { key, label, ...data })

  await setRunStatus(runId, "running")
  await setBusiness(businessId, { status: "reading", error: null })

  try {
    // 1. The site itself.
    const site = await readSite(business.url, async (key, data) => {
      if (key === "home") await step("home", "Opened your site", data)
      if (key === "map") await step("map", `Found ${data?.pages ?? 0} pages`, data)
      if (key === "pages") {
        const read = Number(data?.read ?? 1)
        await step("pages", `Read ${read} ${read === 1 ? "page" : "pages"}`, data)
      }
    })

    // 2. What it says about itself (Claude), or only what the page code states.
    const withClaude = claudeConfigured()
    const profile = withClaude
      ? await extractProfile(site, { businessId, runId })
      : basicProfile(site)
    if (!withClaude)
      await step("profile-basic", "Read the page code only (Claude isn't connected yet)")

    // 3. Where it is.
    let lat = site.jsonLd.lat ?? null
    let lon = site.jsonLd.lon ?? null
    if (
      profile.kind === "place" &&
      (lat == null || lon == null) &&
      (profile.address || profile.city)
    ) {
      const point = await geocode(
        [profile.address, profile.city, profile.country].filter(Boolean).join(", "),
      )
      lat = point?.lat ?? null
      lon = point?.lon ?? null
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.businesses)
        .set({
          host: site.host,
          name: profile.name,
          kind: profile.kind,
          category: profile.category || null,
          summary: profile.summary || null,
          language: profile.language,
          address: profile.address,
          city: profile.city,
          country: profile.country,
          lat,
          lon,
          phone: profile.phone,
          faviconUrl: site.favicon,
          imageUrl: site.ogImage,
          socials: site.socials as Record<string, string>,
          offerings: profile.offerings,
          comparableNames: profile.comparableNames,
        })
        .where(eq(schema.businesses.id, businessId))
      // A re-read replaces what the site said; the owner's own facts stay.
      await tx
        .delete(schema.businessFacts)
        .where(
          and(
            eq(schema.businessFacts.businessId, businessId),
            eq(schema.businessFacts.origin, "site"),
          ),
        )
      if (profile.facts.length)
        await tx.insert(schema.businessFacts).values(
          profile.facts.map((f, position) => ({
            businessId,
            label: f.label,
            value: f.value,
            sourceUrl: f.sourceUrl,
            origin: "site" as const,
            position,
          })),
        )
    })
    await step("profile", `${profile.name}${profile.category ? ` — ${profile.category}` : ""}`, {
      name: profile.name,
      kind: profile.kind,
      category: profile.category,
      city: profile.city,
      facts: profile.facts.length,
    })

    // 4. Who it is in Qloo.
    let status: Status = "ready"
    if (!qlooConfigured()) {
      await step("qloo-unavailable", "Qloo isn't connected yet: your people will appear once it is")
    } else {
      await setBusiness(businessId, { status: "matching" })
      const resolution = await resolveBusiness(
        {
          name: profile.name,
          kind: profile.kind,
          website: site.url,
          address: profile.address,
          city: profile.city,
          lat,
          lon,
          socials: site.socials,
          wikidata: wikidataId(site.jsonLd.sameAs),
          comparableNames: profile.comparableNames,
        },
        { businessId, runId },
      )
      await saveResolution(businessId, resolution)
      if (resolution.status === "matched" && resolution.own)
        await step("qloo", `Found you in Qloo: ${resolution.own.item.name}`, {
          evidence: resolution.own.evidence,
        })
      else if (resolution.status === "ambiguous") {
        status = "confirm"
        await step(
          "qloo-confirm",
          `Qloo has ${resolution.candidates.length} possible matches — which one is you?`,
        )
      } else
        await step(
          "qloo",
          resolution.comparables.length
            ? `Not in Qloo yet — we'll find your people through ${resolution.comparables.length} places like you`
            : "Not in Qloo yet, and no comparables found",
          { route: resolution.comparablesRoute },
        )
    }

    await setBusiness(businessId, { status })
    await setRunStatus(runId, status === "confirm" ? "waiting" : "done")
  } catch (error) {
    const reason =
      error instanceof SiteUnreadable || error instanceof ClaudeNotConfigured
        ? error.message
        : "Something went wrong reading this site"
    console.error("[business-setup]", error)
    await setBusiness(businessId, { status: "failed", error: reason })
    await setRunStatus(runId, "failed", reason)
  }
}
