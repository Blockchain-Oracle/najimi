/*
 * Deterministic facts a page gives away without any model: schema.org JSON-LD (name, address,
 * coordinates, sameAs links) and social links in the HTML. These beat a model's reading when present.
 */

export type Socials = Partial<
  Record<"instagram" | "twitter" | "facebook" | "tiktok" | "spotify" | "youtube", string>
>

export type JsonLdFacts = {
  types: string[]
  name?: string
  address?: string
  city?: string
  country?: string
  lat?: number
  lon?: number
  phone?: string
  sameAs: string[]
  cuisine: string[]
}

const SOCIAL_PATTERNS: [keyof Socials, RegExp][] = [
  ["instagram", /instagram\.com\/([A-Za-z0-9_.]{2,30})/i],
  ["twitter", /(?:twitter|x)\.com\/([A-Za-z0-9_]{2,15})(?![A-Za-z0-9_])/i],
  ["facebook", /facebook\.com\/([A-Za-z0-9.-]{3,60})/i],
  ["tiktok", /tiktok\.com\/@([A-Za-z0-9_.]{2,24})/i],
  ["spotify", /open\.spotify\.com\/artist\/([A-Za-z0-9]{22})/i],
  ["youtube", /youtube\.com\/(@[A-Za-z0-9_.-]{3,30}|channel\/[A-Za-z0-9_-]{10,30})/i],
]

/** Paths that look like a handle but are a platform page ("instagram.com/p/…", "x.com/share"). */
const NOT_HANDLES = new Set([
  "p",
  "reel",
  "share",
  "intent",
  "sharer",
  "home",
  "explore",
  "plugins",
  "tr",
  "dialog",
  "watch",
])

/** The business's own social handles, from the links on its pages (the first of each wins). */
export function socialHandles(html: string): Socials {
  const out: Socials = {}
  const links = html.match(/https?:\/\/[^\s"'<>)]+/g) ?? []
  for (const link of links) {
    for (const [network, pattern] of SOCIAL_PATTERNS) {
      if (out[network]) continue
      const handle = pattern.exec(link)?.[1]
      if (handle && !NOT_HANDLES.has(handle.toLowerCase())) out[network] = handle.replace(/\/$/, "")
    }
  }
  return out
}

type Node = Record<string, unknown>

const asArray = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value]

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const num = (value: unknown): number | undefined => {
  const n = typeof value === "string" ? Number(value) : value
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

/** Every JSON-LD node on the page, flattening @graph arrays. */
export function jsonLdNodes(html: string): Node[] {
  const nodes: Node[] = []
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]?.trim() ?? "") as unknown
      for (const item of asArray(parsed as Node | Node[])) {
        nodes.push(item)
        for (const child of asArray((item as Node)["@graph"] as Node[] | undefined))
          nodes.push(child)
      }
    } catch {
      // A broken block on someone's site isn't our failure; skip it.
    }
  }
  return nodes
}

/** The business facts in a page's JSON-LD (the first node that names a business wins). */
export function jsonLdFacts(html: string): JsonLdFacts {
  const facts: JsonLdFacts = { types: [], sameAs: [], cuisine: [] }
  for (const node of jsonLdNodes(html)) {
    const types = asArray(node["@type"] as string | string[]).filter((t) => typeof t === "string")
    if (
      !types.length ||
      types.some((t) => /^(WebSite|WebPage|BreadcrumbList|ImageObject)$/.test(t))
    )
      continue
    facts.types.push(...types)
    facts.name ??= str(node.name)
    facts.phone ??= str(node.telephone)
    const address = asArray<Node | string>(node.address as Node | string)[0]
    if (typeof address === "string") facts.address ??= address
    else if (address) {
      facts.address ??= [
        str(address.streetAddress),
        str(address.addressLocality),
        str(address.postalCode),
      ]
        .filter(Boolean)
        .join(", ")
      facts.city ??= str(address.addressLocality)
      const country = address.addressCountry
      facts.country ??= str(
        typeof country === "object" && country ? (country as Node).name : country,
      )
    }
    const geo = asArray<Node>(node.geo as Node)[0]
    if (geo) {
      facts.lat ??= num(geo.latitude)
      facts.lon ??= num(geo.longitude)
    }
    facts.sameAs.push(
      ...asArray(node.sameAs as string | string[]).filter((s) => typeof s === "string"),
    )
    facts.cuisine.push(
      ...asArray(node.servesCuisine as string | string[]).filter((s) => typeof s === "string"),
    )
  }
  facts.types = [...new Set(facts.types)]
  return facts
}

/** A Wikidata id from sameAs links (Q-number), when the site lists one. */
export function wikidataId(sameAs: string[]): string | undefined {
  for (const link of sameAs) {
    const id = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i.exec(link)?.[1]
    if (id) return id
  }
  return undefined
}
