import { createOpenAI } from "@ai-sdk/openai"
import { AGENT } from "@najimi/config"
import { env } from "@najimi/env/server"
import { generateText } from "ai"
import { cached } from "./cache"
import { fetchSitePage, sameSite } from "./fetch"
import { type Product, parseProduct } from "./jsonld"

export type BrandProducts = { brand: string; site: string; products: Product[] }

const PER_BRAND = 3

const hostOf = (site: string) => {
  try {
    return new URL(site.startsWith("http") ? site : `https://${site}`).hostname.replace(
      /^www\./,
      "",
    )
  } catch {
    return null
  }
}

/**
 * Real products for "get the look" (T13): web search limited to the brand's own domain finds
 * product pages; our own fetch reads their schema.org Product data. The search model only ever
 * sees the brand and the category; nothing from the pages goes back to any model.
 */
export async function productsFor(
  brand: { name: string; site: string },
  category: string,
): Promise<BrandProducts> {
  const site = hostOf(brand.site)
  if (!site || !env.OPENAI_API_KEY) return { brand: brand.name, site: brand.site, products: [] }
  return cached("products", `${site}:${category.toLowerCase()}`, 7, async () => {
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY ?? "",
      baseURL: AGENT.baseUrls.openai,
    })
    const result = await generateText({
      model: openai("gpt-6-astra"),
      prompt: `Find up to ${PER_BRAND + 2} individual product pages for "${category}" sold on ${site} by ${brand.name}. Answer with the URLs only.`,
      tools: {
        web_search: openai.tools.webSearch({
          searchContextSize: "low",
          filters: { allowedDomains: [site] },
        }),
      },
      toolChoice: { type: "tool", toolName: "web_search" },
      providerOptions: { openai: { reasoningEffort: "low" } },
      abortSignal: AbortSignal.timeout(45_000),
    }).catch(() => null)
    const urls = [
      ...new Set(
        [
          ...(result?.sources ?? []).map((s) => ("url" in s ? s.url : "")),
          ...(result?.text.match(/https:\/\/[^\s)"'<>]+/g) ?? []),
        ].filter((u) => {
          try {
            return sameSite(new URL(u).hostname, site)
          } catch {
            return false
          }
        }),
      ),
    ].slice(0, PER_BRAND + 3)
    const pages = await Promise.all(urls.map((u) => fetchSitePage(u, site)))
    // A product page has a price; category and listing pages often describe themselves as products
    // without one. One card per product name.
    const seen = new Set<string>()
    const products = pages
      .flatMap((p) => (p ? [parseProduct(p.html, p.url)] : []))
      .filter((p): p is Product => Boolean(p?.name) && p?.price != null)
      .filter((p) => !seen.has(p.name.toLowerCase()) && Boolean(seen.add(p.name.toLowerCase())))
      .slice(0, PER_BRAND)
    return { brand: brand.name, site: `https://${site}`, products }
  })
}
