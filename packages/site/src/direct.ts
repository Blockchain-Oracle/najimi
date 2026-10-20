/*
 * Reading a site without Firecrawl: a plain fetch of the HTML, its links for discovery, and a small
 * HTML → text conversion. Free and real; weaker than Firecrawl on sites that render with JavaScript,
 * so it's the fallback (out of credits, not configured, or blocked).
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; Najimi/0.1; reads a business's own site at its request)"
const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 15_000

export type FetchedPage = { url: string; html: string }

export async function fetchHtml(url: string): Promise<FetchedPage | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const type = response.headers.get("content-type") ?? ""
    if (!response.ok || !type.includes("html")) return null
    const html = await response.text()
    return { url: response.url || url, html: html.slice(0, MAX_BYTES) }
  } catch {
    return null
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
}

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

/** Readable text from HTML, headings marked with #, list items with -, links dropped to their text. */
export function htmlToText(html: string): string {
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html
  return decodeEntities(
    body
      .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<h([1-6])[^>]*>/gi, (_m, level: string) => `\n\n${"#".repeat(Number(level))} `)
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|header|footer|h[1-6]|ul|ol|table|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const attr = (tag: string, name: string) =>
  new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1]

/** <meta name|property="…" content="…"> by key, case-insensitive. */
export function metaContent(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attr(tag, "name") ?? attr(tag, "property")
    if (name?.toLowerCase() === key.toLowerCase()) {
      const content = attr(tag, "content")
      if (content) return decodeEntities(content).trim() || null
    }
  }
  return null
}

export function pageTitle(html: string): string | null {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return title ? decodeEntities(title).replace(/\s+/g, " ").trim() || null : null
}

export function htmlLang(html: string): string | null {
  return /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html)?.[1] ?? null
}

/** The site's favicon from <link rel="icon">, absolute. */
export function faviconOf(html: string, base: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? ""
    const href = attr(tag, "href")
    if (href && /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) {
      try {
        return new URL(href, base).toString()
      } catch {}
    }
  }
  return null
}

/** Every same-site link on the page, absolute, without fragments or queries. */
export function sameSiteLinks(html: string, base: string): string[] {
  const host = new URL(base).hostname.replace(/^www\./, "")
  const links = new Set<string>()
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const href = match[1] ?? ""
      if (href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue
      const url = new URL(href, base)
      if (url.hostname.replace(/^www\./, "") !== host || !url.protocol.startsWith("http")) continue
      url.search = ""
      url.hash = ""
      links.add(url.toString().replace(/\/$/, ""))
    } catch {}
  }
  return [...links]
}
