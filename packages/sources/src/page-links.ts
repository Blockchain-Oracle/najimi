/*
 * A homepage's own social accounts and icon, read from its HTML (no fetching here, so it tests
 * without a network or a database).
 */

export type SiteLinks = {
  instagram: string | null
  tiktok: string | null
  x: string | null
  facebook: string | null
  youtube: string | null
  /** The site's own icon (apple-touch-icon), else Google's favicon service. */
  logo: string | null
}

const NOT_HANDLES = new Set([
  "p",
  "reel",
  "reels",
  "explore",
  "stories",
  "accounts",
  "intent",
  "share",
  "sharer",
  "home",
  "tr",
  "plugins",
  "dialog",
  "hashtag",
])

const firstHandle = (html: string, pattern: RegExp) => {
  for (const m of html.matchAll(pattern)) {
    const handle = m[1]
    if (handle && !NOT_HANDLES.has(handle.toLowerCase())) return handle
  }
  return null
}

/** Social accounts and a logo from a homepage's HTML (exported for tests). */
export function linksInPage(html: string, pageUrl: string): SiteLinks {
  const icon =
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(
      html,
    )?.[1] ??
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i.exec(html)?.[1]
  let logo: string | null = null
  try {
    logo = icon ? new URL(icon, pageUrl).toString() : null
  } catch {}
  const host = new URL(pageUrl).hostname
  return {
    instagram: firstHandle(html, /instagram\.com\/([A-Za-z0-9_.]{1,30})\/?["'?#]/g),
    tiktok: firstHandle(html, /tiktok\.com\/@([A-Za-z0-9_.]{1,30})/g),
    x: firstHandle(html, /(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/?["'?#]/g),
    facebook: firstHandle(html, /facebook\.com\/([A-Za-z0-9.]{2,50})\/?["'?#]/g),
    youtube: firstHandle(html, /youtube\.com\/((?:@|channel\/|user\/|c\/)[A-Za-z0-9_.-]{2,60})/g),
    logo: logo ?? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
  }
}
