/** Accepts "joes.com", "www.joes.com" or a full URL, and returns a normalized https URL. */
export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null
    return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/$/, ""))
  } catch {
    return null
  }
}
