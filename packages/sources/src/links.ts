import { env } from "@najimi/env/server"
import { cached } from "./cache"
import { fetchPublic } from "./fetch"
import { linksInPage, type SiteLinks } from "./page-links"

/*
 * What a thing links out to, beyond what Qloo carries: a place's or brand's own socials and logo
 * (read from its homepage: schema.org sameAs, then social links in the page), and a film's or
 * show's extra videos and where to watch it (TMDB; where-to-watch data is JustWatch's).
 */

const DAYS = 30

/** A site's socials and logo, read once a month. */
export async function siteLinks(website: string): Promise<SiteLinks | null> {
  let url: URL
  try {
    url = new URL(website)
  } catch {
    return null
  }
  // A page that didn't load (many sites turn bots away) isn't remembered, and still gives the
  // site's icon from Google's favicon service; one that did load is kept for a month.
  return cached("site-links", `${url.hostname}${url.pathname}`, DAYS, async () => {
    const page = await fetchPublic(url.toString(), { maxBytes: 600_000, accept: "text/html" })
    if (!page) throw new Error("site didn't load")
    return linksInPage(page.text, page.url)
  }).catch(() => ({
    instagram: null,
    tiktok: null,
    x: null,
    facebook: null,
    youtube: null,
    logo: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=128`,
  }))
}

export type FilmExtras = {
  /** Featurettes, clips, behind the scenes (YouTube keys), beyond the trailer. */
  videos: { youtube: string; title: string; type: string }[]
  /** Where to watch it in this country (JustWatch data via TMDB). */
  providers: { name: string; logo: string | null; kind: "stream" | "rent" | "buy" }[]
  /** TMDB's watch page for that country (the link JustWatch's terms ask us to show). */
  watchLink: string | null
}

type Find = { movie_results?: { id: number }[]; tv_results?: { id: number }[] }
type Videos = { results?: { key: string; site: string; type: string; name: string }[] }
type Provider = { provider_name: string; logo_path: string | null }
type Providers = {
  results?: Record<
    string,
    { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[] }
  >
}

const tmdb = async <T>(path: string): Promise<T | null> => {
  const token = env.TMDB_READ_TOKEN
  if (!token) return null
  const res = await fetch(`https://api.themoviedb.org/3/${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null)
  return res?.ok ? ((await res.json().catch(() => null)) as T | null) : null
}

/** A film's or show's extra videos and where to watch it, by its IMDb id and a country (ISO 3166-1). */
export async function filmExtras(imdb: string, country: string): Promise<FilmExtras | null> {
  if (!/^tt\d+$/.test(imdb) || !/^[A-Z]{2}$/.test(country)) return null
  return cached<FilmExtras | null>("film-extras", `${imdb}:${country}`, 7, async () => {
    const found = await tmdb<Find>(`find/${imdb}?external_source=imdb_id`)
    // TMDB not answering isn't "nothing": don't keep it.
    if (!found) throw new Error("TMDB didn't answer")
    const movie = found?.movie_results?.[0]
    const tv = found?.tv_results?.[0]
    const path = movie ? `movie/${movie.id}` : tv ? `tv/${tv.id}` : null
    if (!path) return null
    const [videos, providers] = await Promise.all([
      tmdb<Videos>(`${path}/videos`),
      tmdb<Providers>(`${path}/watch/providers`),
    ])
    const extra = (videos?.results ?? [])
      .filter(
        (v) => v.site === "YouTube" && ["Featurette", "Clip", "Behind the Scenes"].includes(v.type),
      )
      .slice(0, 6)
      .map((v) => ({ youtube: v.key, title: v.name, type: v.type }))
    const here = providers?.results?.[country]
    const logo = (p: Provider) =>
      p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null
    const seen = new Set<string>()
    const list: FilmExtras["providers"] = []
    for (const [kind, items] of [
      ["stream", here?.flatrate],
      ["rent", here?.rent],
      ["buy", here?.buy],
    ] as const)
      for (const p of items ?? [])
        if (!seen.has(p.provider_name)) {
          seen.add(p.provider_name)
          list.push({ name: p.provider_name, logo: logo(p), kind })
        }
    return { videos: extra, providers: list.slice(0, 8), watchLink: here?.link ?? null }
  }).catch(() => null)
}
