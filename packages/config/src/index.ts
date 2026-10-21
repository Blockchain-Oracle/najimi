/**
 * Every product constant lives here: limits, timeouts, sizes, ports, names, models.
 * Code elsewhere imports these instead of writing numbers inline.
 */

export const APP = {
  name: "Najimi",
  /** 馴染み: familiar, the one who knows you. */
  meaning: "familiar",
  tagline: "The taste copilot.",
  description:
    "Tell Najimi what you love. It makes things for your real life that fit you — your room relit, dinner for your mum, your next book — and shows the real Qloo taste data behind every choice.",
  /** The public repository and live URLs, once they exist; links stay hidden until then. */
  repository: null as string | null,
  url: null as string | null,
  docs: null as string | null,
} as const

/** Local development ports, chosen to sit beside Konkyo (3210/3211/54320) without clashing. */
export const LOCAL_PORTS = {
  web: 3310,
  docs: 3311,
  postgres: 54330,
} as const

export const ROUTES = {
  home: "/",
  start: "/start",
} as const

export const DB = {
  /** Connections per process (web and worker each hold one pool). */
  poolMax: 10,
} as const

export const AUTH = {
  /** Sessions last a month and refresh daily while in use. */
  sessionExpiresInSeconds: 30 * 24 * 60 * 60,
  sessionUpdateAgeSeconds: 24 * 60 * 60,
  /**
   * Guests get a generated placeholder address (Better Auth anonymous plugin). It is never
   * emailed; `.invalid` is reserved by RFC 2606, so it can never reach a real inbox.
   */
  guestEmailDomain: "guest.najimi.invalid",
} as const

export const QUERY = {
  /** Data stays fresh for a minute; live events invalidate sooner. */
  staleTimeMs: 60_000,
} as const

export const LIVE = {
  /** One Postgres channel carries run-event ids; payloads stay tiny (NOTIFY caps at 8000 bytes). */
  channel: "run_events",
  /** Proxies close quiet connections; a comment this often keeps a stream open. */
  pingMs: 15_000,
  /** A reconnecting stream replays at most this many missed events. */
  replayMax: 500,
} as const

export const JOBS = {
  /** pg-boss lives in its own schema in the app database. */
  schema: "pgboss",
  /** How often a running job proves it's alive; a dead worker's job is retried after this. */
  heartbeatSeconds: 30,
} as const

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Qloo (plan §3). Retry and timeout behaviour copies the official harness's client
 * (@qloo/qloo-harness 0.1.26): 20 s timeout, 3 attempts, retry on 429/5xx with jittered backoff,
 * Retry-After honoured up to 30 s, bodies capped at 5 MB. Cache lifetimes are our own analysis:
 * the guide allows private server-side caching with no time limit.
 */
export const QLOO = {
  baseUrl: "https://hackathon.api.qloo.com",
  timeoutMs: 20_000,
  attempts: 3,
  backoffBaseMs: 250,
  backoffJitter: 0.25,
  retryAfterCapMs: 30_000,
  maxBodyBytes: 5 * 1024 * 1024,
  retryStatuses: [429, 500, 502, 503, 504],
  /** Insights `take` maximum (Deep Dive); search allows more but we never need it. */
  takeMax: 50,
  /** Parallel Qloo requests per process (the taste portrait fans out over ten domains). */
  concurrency: 4,
  /** Cache lifetime by path prefix; the longest matching prefix wins. */
  ttlMs: {
    "/search": 30 * DAY_MS,
    "/entities": 30 * DAY_MS,
    "/v2/tags": 30 * DAY_MS,
    "/v2/audiences": 30 * DAY_MS,
    "/v2/insights": 7 * DAY_MS,
    "/v2/analysis/compare": 7 * DAY_MS,
    "/v2/trending": DAY_MS,
  } as Record<string, number>,
  defaultTtlMs: 7 * DAY_MS,
} as const

/** The loves typeahead (T2): Qloo search across every domain, as you type. */
export const LOVES = {
  searchMinChars: 2,
  searchTake: 8,
  searchDebounceMs: 250,
} as const

/** The ten taste domains, in the order the product shows them. */
export const TASTE_DOMAINS = [
  { key: "artist", type: "urn:entity:artist", label: "Music", artwork: true },
  { key: "movie", type: "urn:entity:movie", label: "Film", artwork: true },
  { key: "tv_show", type: "urn:entity:tv_show", label: "TV", artwork: true },
  { key: "book", type: "urn:entity:book", label: "Books", artwork: true },
  { key: "podcast", type: "urn:entity:podcast", label: "Podcasts", artwork: true },
  { key: "brand", type: "urn:entity:brand", label: "Brands", artwork: true },
  { key: "place", type: "urn:entity:place", label: "Places", artwork: true },
  // Destinations and people mostly have no artwork in Qloo; their rows use poster tiles.
  { key: "destination", type: "urn:entity:destination", label: "Destinations", artwork: false },
  // `urn:entity:video_game` is a 400 on the hackathon host; `videogame` works (live 2026-10-21).
  { key: "videogame", type: "urn:entity:videogame", label: "Games", artwork: true },
  { key: "person", type: "urn:entity:person", label: "People", artwork: false },
] as const
