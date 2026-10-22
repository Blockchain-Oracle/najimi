import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3

/** Private, loopback, link-local and other non-public addresses (IPv4 and IPv6). */
function isPrivate(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v.startsWith("::ffff:")) return isPrivate(v.slice(7))
    return (
      v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")
    )
  }
  const [a = 0, b = 0] = ip.split(".").map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

export const sameSite = (host: string, site: string) => host === site || host.endsWith(`.${site}`)

/**
 * Fetches one page from a brand's own site, and nothing else: https only, the brand's host (or a
 * subdomain), every address public (no requests into our own network), redirects followed only
 * within the same site, a size and time cap. Returns the HTML or null.
 */
export async function fetchSitePage(
  url: string,
  site: string,
): Promise<{ html: string; url: string } | null> {
  let current = new URL(url)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:" || !sameSite(current.hostname, site)) return null
    const addresses = await lookup(current.hostname, { all: true }).catch(() => [])
    if (!addresses.length || addresses.some((a) => isPrivate(a.address))) return null
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; NajimiBot/1.0; product lookup)",
        accept: "text/html",
      },
    }).catch(() => null)
    if (!response) return null
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location")
      if (!next) return null
      current = new URL(next, current)
      continue
    }
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) return null
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    return { html: Buffer.concat(chunks).toString("utf8"), url: current.toString() }
  }
  return null
}

/**
 * Fetches a document from anywhere public (a podcast's own RSS feed, named by Apple's directory):
 * http or https, every address public, at most three redirects (each checked again), and only the
 * first `maxBytes` read. Returns the text and where it ended up, or null.
 */
export async function fetchPublic(
  url: string,
  { maxBytes = MAX_BYTES, accept = "*/*" }: { maxBytes?: number; accept?: string } = {},
): Promise<{ text: string; url: string } | null> {
  let current: URL
  try {
    current = new URL(url)
  } catch {
    return null
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:" && current.protocol !== "http:") return null
    const addresses = await lookup(current.hostname, { all: true }).catch(() => [])
    if (!addresses.length || addresses.some((a) => isPrivate(a.address))) return null
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; Najimi/1.0)", accept },
    }).catch(() => null)
    if (!response) return null
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location")
      if (!next) return null
      current = new URL(next, current)
      continue
    }
    if (!response.ok) return null
    const reader = response.body?.getReader()
    if (!reader) return null
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      chunks.push(value)
      if (size >= maxBytes) {
        await reader.cancel()
        break
      }
    }
    return { text: Buffer.concat(chunks).toString("utf8"), url: current.toString() }
  }
  return null
}
