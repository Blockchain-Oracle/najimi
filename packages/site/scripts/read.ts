/**
 * Reads one site the way the app does (no model): `pnpm --filter @najimi/site read <url>`.
 * Prints what was found; useful when a pasted site reads badly.
 */
import { readSite } from "../src/read"

const url = process.argv[2]
if (!url) {
  console.error("usage: read <url>")
  process.exit(2)
}
const site = await readSite(url, async (step, data) => console.log(`· ${step}`, data ?? ""))
console.log({
  host: site.host,
  title: site.title,
  language: site.language,
  ogImage: Boolean(site.ogImage),
  favicon: site.favicon,
  jsonLd: { ...site.jsonLd, sameAs: site.jsonLd.sameAs.length },
  socials: site.socials,
  pages: site.pages.map((p) => `${p.url} (${p.markdown.length} chars)`),
})
