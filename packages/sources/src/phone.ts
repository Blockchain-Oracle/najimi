import { fetchPublic } from "./fetch"

/*
 * A venue's phone number from its own website (Qloo gives the site, not the number): schema.org
 * `telephone` first, then the page's tel: links. Numbers come back in international form when the
 * page gives a country code, or with the country's code added when we know it.
 */

const digits = (s: string) => s.replace(/[^\d+]/g, "")

/** "+234 803 123 4567", "0803 123 4567" (with dial code 234) → "+2348031234567". */
export function normalisePhone(raw: string, dialCode?: string | null): string | null {
  let n = digits(raw)
  if (n.startsWith("00")) n = `+${n.slice(2)}`
  if (n.startsWith("+")) return n.length >= 9 && n.length <= 16 ? n : null
  if (!dialCode) return null
  n = n.replace(/^0+/, "")
  const full = `+${dialCode}${n}`
  return full.length >= 9 && full.length <= 16 ? full : null
}

export function phoneFrom(html: string): string | null {
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const found = /"telephone"\s*:\s*"([^"]{5,40})"/.exec(m[1] ?? "")
    if (found?.[1]) return found[1].trim()
  }
  const tel = /href=["']tel:([^"']{5,40})["']/i.exec(html)
  return tel?.[1] ? decodeURIComponent(tel[1]).trim() : null
}

/** The venue's number from its site, in international form, or null. */
export async function venuePhone(website: string, dialCode?: string | null) {
  const page = await fetchPublic(website, { maxBytes: 600_000, accept: "text/html" })
  const raw = page ? phoneFrom(page.text) : null
  return raw ? normalisePhone(raw, dialCode) : null
}
