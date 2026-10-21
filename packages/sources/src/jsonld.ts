/*
 * schema.org Product data from a page's HTML (JSON-LD first, Open Graph as the fallback). Pure: no
 * network, so it's tested on its own. Only short, typed fields come out; page text never does.
 */

export type Product = {
  name: string
  image: string | null
  price: number | null
  currency: string | null
  url: string
}

const clip = (s: unknown, n: number) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : ""

function firstImage(image: unknown): string | null {
  if (typeof image === "string") return image
  if (Array.isArray(image)) return firstImage(image[0])
  if (image && typeof image === "object") {
    const o = image as { url?: unknown; contentUrl?: unknown }
    return firstImage(o.url ?? o.contentUrl)
  }
  return null
}

function priceOf(offers: unknown): { price: number | null; currency: string | null } {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : []
  for (const o of list) {
    if (!o || typeof o !== "object") continue
    const offer = o as {
      price?: unknown
      lowPrice?: unknown
      priceCurrency?: unknown
      priceSpecification?: unknown
      offers?: unknown
    }
    const raw =
      offer.price ??
      offer.lowPrice ??
      (offer.priceSpecification as { price?: unknown } | undefined)?.price
    const price =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number.parseFloat(raw.replace(/[^\d.]/g, ""))
          : Number.NaN
    if (Number.isFinite(price)) return { price, currency: clip(offer.priceCurrency, 8) || null }
    if (offer.offers) return priceOf(offer.offers)
  }
  return { price: null, currency: null }
}

const isProduct = (node: unknown): node is Record<string, unknown> => {
  if (!node || typeof node !== "object") return false
  const type = (node as { "@type"?: unknown })["@type"]
  return (
    type === "Product" ||
    (Array.isArray(type) && type.includes("Product")) ||
    type === "ProductGroup"
  )
}

/** Every node in a JSON-LD document (top level, arrays and @graph). */
function nodes(doc: unknown): unknown[] {
  if (Array.isArray(doc)) return doc.flatMap(nodes)
  if (doc && typeof doc === "object") {
    const graph = (doc as { "@graph"?: unknown })["@graph"]
    return [doc, ...(graph ? nodes(graph) : [])]
  }
  return []
}

const meta = (html: string, property: string) =>
  new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  ).exec(html)?.[1] ??
  new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  ).exec(html)?.[1] ??
  null

/** The product a page describes, or null when it doesn't describe one. */
export function parseProduct(html: string, pageUrl: string): Product | null {
  const scripts = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ]
  for (const [, body] of scripts) {
    let doc: unknown
    try {
      doc = JSON.parse(body ?? "")
    } catch {
      continue
    }
    const product = nodes(doc).find(isProduct)
    if (!product) continue
    const variant = Array.isArray(product.hasVariant)
      ? (product.hasVariant[0] as Record<string, unknown>)
      : undefined
    const name = clip(product.name, 120)
    if (!name) continue
    const { price, currency } = priceOf(product.offers ?? variant?.offers)
    const image = firstImage(product.image ?? variant?.image)
    return {
      name,
      image: image ? new URL(image, pageUrl).toString() : null,
      price,
      currency,
      url: pageUrl,
    }
  }
  const ogType = meta(html, "og:type")
  const title = meta(html, "og:title")
  if (title && (ogType?.includes("product") || meta(html, "product:price:amount"))) {
    const amount = meta(html, "product:price:amount")
    const image = meta(html, "og:image")
    return {
      name: clip(title, 120),
      image: image ? new URL(image, pageUrl).toString() : null,
      price: amount ? Number.parseFloat(amount) : null,
      currency: meta(html, "product:price:currency"),
      url: pageUrl,
    }
  }
  return null
}
