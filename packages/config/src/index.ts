/**
 * Every product constant lives here: limits, timeouts, sizes, ports, names, models.
 * Code elsewhere imports these instead of writing numbers inline.
 */

export const APP = {
  name: "Najimi",
  /** 馴染み: your regular place, where they know you. */
  meaning: "your regular place",
  tagline: "Find your people.",
  description:
    "Paste your website. Najimi finds your people with Qloo — who they are, what else they love, where they are — then goes and gets them, one approval at a time.",
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
  signIn: "/sign-in",
  app: "/app",
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
