import { SITE } from "@najimi/config"
import { env } from "@najimi/env/server"
import Firecrawl from "firecrawl"
import {
  faviconOf,
  fetchHtml,
  htmlLang,
  htmlToText,
  metaContent,
  pageTitle,
  sameSiteLinks,
} from "./direct"
import { type JsonLdFacts, jsonLdFacts, type Socials, socialHandles } from "./parse"

/*
 * Reading a pasted website (F1, plan §6). Firecrawl first (it renders JavaScript sites): scrape the
 * home page with its HTML, map the site, batch-read the few pages most likely to hold facts. When
 * Firecrawl can't (no key, out of credits, blocked), the same steps run on a plain fetch of the
 * site's own HTML. No model here.
 */

export class SiteUnreadable extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = "SiteUnreadable"
  }
}

export type SitePage = { url: string; title: string | null; markdown: string }

export type SiteRead = {
  url: string
  host: string
  /** How the pages were read, for the setup step's honesty. */
  via: "firecrawl" | "direct"
  pages: SitePage[]
  title: string | null
  description: string | null
  siteName: string | null
  ogImage: string | null
  favicon: string | null
  language: string | null
  jsonLd: JsonLdFacts
  socials: Socials
}

type OnStep = (step: string, data?: Record<string, unknown>) => Promise<void>

type Meta = {
  title?: string
  ogTitle?: string
  description?: string
  ogDescription?: string
  ogSiteName?: string
  ogImage?: string
  favicon?: string
  language?: string
  ogLocale?: string
  statusCode?: number
}

const clean = (text: string | undefined | null) => text?.replace(/\s+/g, " ").trim() || null

const trim = (markdown: string) =>
  markdown.length > SITE.maxCharsPerPage
    ? `${markdown.slice(0, SITE.maxCharsPerPage)}\n…`
    : markdown

/** Which fact-bearing kind of page a link is (index into SITE.pageHints), its depth, or null. */
export function pageKind(link: string, host: string): { hint: number; depth: number } | null {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  if (url.hostname.replace(/^www\./, "") !== host) return null
  if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4)$/i.test(url.pathname)) return null
  const segments = url.pathname.toLowerCase().split("/").filter(Boolean)
  if (!segments.length || segments.length > 2) return null
  const hint = SITE.pageHints.findIndex((h) => segments.some((s) => s.includes(h)))
  return hint === -1 ? null : { hint, depth: segments.length }
}

/** One page per kind (about, menu, contact…), best kinds first, shallow paths before deep ones. */
export function pickPages(home: string, links: string[], host: string): string[] {
  const best = new Map<number, { link: string; depth: number }>()
  const homeKey = home.replace(/\/$/, "")
  for (const raw of links) {
    const link = raw.replace(/\/$/, "")
    if (link === homeKey) continue
    const kind = pageKind(link, host)
    if (!kind) continue
    const current = best.get(kind.hint)
    if (
      !current ||
      kind.depth < current.depth ||
      (kind.depth === current.depth && link.length < current.link.length)
    )
      best.set(kind.hint, { link, depth: kind.depth })
  }
  return [...best.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, SITE.extraPages)
    .map(([, v]) => v.link)
}

function firecrawlClient(): Firecrawl | null {
  // The shell's key (Abu's) also counts, as with every variable (scripts/with-env.mjs).
  const apiKey = env.FIRECRAWL_API_KEY ?? process.env.FIRECRAWL_API_KEY
  return apiKey ? new Firecrawl({ apiKey }) : null
}

const warn = (where: string, error: unknown) =>
  console.warn(`[site] ${where}:`, error instanceof Error ? error.message : error)

/** Extra pages read directly (no Firecrawl), in parallel, keeping those that answer. */
async function readDirectPages(urls: string[]): Promise<SitePage[]> {
  const fetched = await Promise.all(urls.map((u) => fetchHtml(u)))
  return fetched
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ url: p.url, title: pageTitle(p.html), markdown: trim(htmlToText(p.html)) }))
    .filter((p) => p.markdown.length > 0)
}

export async function readSite(url: string, onStep?: OnStep): Promise<SiteRead> {
  const host = new URL(url).hostname.replace(/^www\./, "")
  const client = firecrawlClient()

  // 1. The home page, with its HTML (JSON-LD, social links, favicon, language).
  let via: SiteRead["via"] = "firecrawl"
  let homeHtml = ""
  let homeText = ""
  let meta: Meta = {}
  if (client) {
    try {
      const home = await client.scrape(url, {
        formats: ["markdown", "rawHtml"],
        onlyMainContent: false,
        timeout: SITE.scrapeTimeoutMs,
      })
      meta = home.metadata ?? {}
      homeHtml = home.rawHtml ?? ""
      homeText = home.markdown ?? ""
    } catch (error) {
      warn("firecrawl home", error)
    }
  }
  if (!homeHtml) {
    via = "direct"
    const page = await fetchHtml(url)
    if (!page) throw new SiteUnreadable(`We couldn't open ${host}`)
    homeHtml = page.html
    homeText = htmlToText(page.html)
    meta = {
      title: pageTitle(page.html) ?? undefined,
      description: metaContent(page.html, "description") ?? undefined,
      ogTitle: metaContent(page.html, "og:title") ?? undefined,
      ogDescription: metaContent(page.html, "og:description") ?? undefined,
      ogSiteName: metaContent(page.html, "og:site_name") ?? undefined,
      ogImage: metaContent(page.html, "og:image") ?? undefined,
      favicon: faviconOf(page.html, page.url) ?? undefined,
      language: htmlLang(page.html) ?? undefined,
    }
  }
  if (meta.statusCode && meta.statusCode >= 400)
    throw new SiteUnreadable(`${host} answered ${meta.statusCode}`)
  await onStep?.("home", { title: clean(meta.title ?? meta.ogTitle) ?? host, via })

  // 2. The site's pages: Firecrawl's map, else the home page's own links.
  let links: string[] = []
  if (client && via === "firecrawl") {
    try {
      const mapped = await client.map(url, { limit: SITE.mapLimit })
      links = (mapped.links ?? []).map((l) => (typeof l === "string" ? l : l.url))
    } catch (error) {
      warn("firecrawl map", error)
    }
  }
  if (!links.length) links = sameSiteLinks(homeHtml, url)
  const extra = pickPages(url, links, host)
  await onStep?.("map", { pages: links.length, reading: extra.length })

  // 3. Read the chosen pages.
  const pages: SitePage[] = [{ url, title: clean(meta.title), markdown: trim(homeText) }]
  let extraPages: SitePage[] = []
  if (extra.length && client && via === "firecrawl") {
    try {
      const batch = await client.batchScrape(extra, {
        options: { formats: ["markdown"], onlyMainContent: true, timeout: SITE.scrapeTimeoutMs },
      })
      extraPages = (batch.data ?? [])
        .filter((doc) => doc.markdown)
        .map((doc) => ({
          url: doc.metadata?.sourceURL ?? doc.metadata?.url ?? "",
          title: clean(doc.metadata?.title),
          markdown: trim(doc.markdown ?? ""),
        }))
    } catch (error) {
      warn("firecrawl pages", error)
    }
  }
  if (extra.length && !extraPages.length) extraPages = await readDirectPages(extra)
  pages.push(...extraPages)
  await onStep?.("pages", { read: pages.length })

  return {
    url,
    host,
    via,
    pages,
    title: clean(meta.title ?? meta.ogTitle),
    description: clean(meta.description ?? meta.ogDescription),
    siteName: clean(meta.ogSiteName),
    ogImage: meta.ogImage ?? null,
    favicon: meta.favicon ?? `${new URL(url).origin}/favicon.ico`,
    language: meta.language ?? meta.ogLocale ?? null,
    jsonLd: jsonLdFacts(homeHtml),
    socials: socialHandles(homeHtml),
  }
}
