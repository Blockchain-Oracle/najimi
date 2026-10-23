/**
 * Every product constant lives here: limits, timeouts, sizes, ports, names, models.
 * Code elsewhere imports these instead of writing numbers inline.
 */

export const APP = {
  name: "Najimi",
  /** 馴染み: someone you know well. */
  meaning: "someone you know well",
  tagline: "The group-chat agent that plans for everyone's taste.",
  description:
    "Najimi is an agent for your group chats: it reads each friend's taste through Qloo, then picks the film, plans the night and routes the trip, showing why each pick fits.",
  /** The public repository and live URLs, once they exist; links stay hidden until then. */
  repository: null as string | null,
  url: "https://najimi.xyz" as string | null,
  docs: "https://docs.najimi.xyz" as string | null,
} as const

/** Local development ports, chosen to sit beside Konkyo (3210/3211/54320) without clashing. */
export const LOCAL_PORTS = {
  web: 3310,
  docs: 3311,
  postgres: 54330,
  s3: 9300,
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
  /** A guest nobody has used for this long is deleted, with everything they made. */
  guestKeepDays: 30,
  /** When the sweep runs (cron, UTC) and how many guests one run takes. */
  guestSweepCron: "17 3 * * *",
  guestSweepBatch: 200,
  /** Usernames: lowercase letters, digits, dots and underscores (the plugin's default rule). */
  usernameMin: 3,
  usernameMax: 24,
  /** Wait this long after typing before checking a username is free. */
  usernameCheckDebounceMs: 350,
} as const

export const QUERY = {
  /** Data stays fresh for a minute; live events invalidate sooner. */
  staleTimeMs: 60_000,
} as const

export const LIVE = {
  /** One Postgres channel carries live-event ids; payloads stay tiny (NOTIFY caps at 8000 bytes). */
  channel: "live_events",
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
  /**
   * The "pick 3" grid at sign-up: well-known things across the domains (with a Lagos lean, where
   * Najimi started), found in Qloo by name so each tile is Qloo's own entity and artwork.
   */
  popular: [
    { q: "Burna Boy", type: "urn:entity:artist" },
    { q: "Beyoncé", type: "urn:entity:artist" },
    { q: "Tems", type: "urn:entity:artist" },
    { q: "Taylor Swift", type: "urn:entity:artist" },
    { q: "Kendrick Lamar", type: "urn:entity:artist" },
    { q: "Bad Bunny", type: "urn:entity:artist" },
    { q: "Insecure", type: "urn:entity:tv_show" },
    { q: "Fleabag", type: "urn:entity:tv_show" },
    { q: "The Bear", type: "urn:entity:tv_show" },
    { q: "Succession", type: "urn:entity:tv_show" },
    { q: "Spirited Away", type: "urn:entity:movie" },
    { q: "Black Panther", type: "urn:entity:movie" },
    { q: "In the Mood for Love", type: "urn:entity:movie" },
    { q: "Parasite", type: "urn:entity:movie" },
    { q: "Americanah", type: "urn:entity:book" },
    { q: "Things Fall Apart", type: "urn:entity:book" },
    { q: "Normal People", type: "urn:entity:book" },
    { q: "Aesop", type: "urn:entity:brand" },
  ],
  /** Cities offered on the map at sign-up (Qloo localities). */
  placesTake: 6,
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

/**
 * The agent: one provider registry (AI SDK), the model chosen by env `AGENT_MODEL` as
 * `provider:model`. Base URLs are pinned so a shell's ANTHROPIC_BASE_URL or OPENAI_BASE_URL
 * (the desktop app sets one for itself) never redirects production traffic.
 */
export const AGENT = {
  /** gpt-6-luna: $0.10 in / $0.50 out per 1M tokens, about 100× less than gpt-6-astra. */
  defaultModel: "openai:gpt-6-luna",
  baseUrls: {
    anthropic: "https://api.anthropic.com/v1",
    openai: "https://api.openai.com/v1",
  },
  /** Tool steps per turn before the model must answer. */
  maxSteps: 10,
  maxOutputTokens: 32_000,
  /** A turn still "generating" after this is shown as interrupted, with Retry. */
  turnTimeoutMs: 5 * 60 * 1000,
  /** Keeps idle proxies from closing a slow chat stream. */
  keepAliveMs: 15_000,
  /** Characters of a chat title. */
  titleMax: 60,
} as const

/**
 * Which model does what (Abu, 2026-10-22: efficient, not dumb, never the most expensive). The
 * agent's turns in rooms (planning, comparing people, games, booking) think with the brain; titles
 * and short phrasing use the light one. Prices per 1M tokens (developers.openai.com pricing,
 * checked 2026-10-22), for the cost each call logs.
 */
export const MODELS = {
  brain: "openai:gpt-6.1-sol",
  light: "openai:gpt-6-luna",
  prices: {
    "openai:gpt-6.1-sol": { input: 2, output: 10, cached: 0.1 },
    "openai:gpt-6-luna": { input: 0.1, output: 0.5, cached: 0.01 },
  } as Record<string, { input: number; output: number; cached: number }>,
} as const

/** Rooms: how the agent's answer streams to everyone in the room. */
export const ROOMS = {
  /** An answer in progress is saved and sent to the room at most this often. */
  flushMs: 150,
  /** A stop request is checked this often while the agent answers. */
  stopCheckMs: 1_000,
  /** Messages a page loads at once (older ones page in as you scroll up). */
  pageSize: 40,
  /** Live events older than this are swept nightly (pages only replay recent ones). */
  liveKeepMs: 2 * 24 * 60 * 60 * 1000,
  /** Messages one person may send per minute. */
  perMinute: 20,
  /** A circle's members hear about new talk at most once in this long, while it's unread. */
  notifyQuietMs: 10 * 60_000,
} as const

/** Games (W9): the wavelength's target bands, the daily drop, the public circle. */
export const GAMES = {
  /** Half-widths of the wavelength's target bands (points off Qloo's number): 90+, 76+, 50+ points. */
  bands: [5, 12, 25],
  /** The daily drop: a wavelength round about a member, in every circle active this week, at this
   * hour in the circle starter's own time zone (the job runs hourly). */
  dropHour: 9,
  /** A circle counts as active if someone spoke in it within this long. */
  activeDays: 7,
  /** The public circle anyone can join from People, run by Najimi. */
  lounge: { name: "Najimi Lounge", token: "najimilounge" },
  /** Rounds one person may start per minute. */
  perMinute: 12,
} as const

/** The Earth (W11, W12): heatmaps over cities, scenes around a spot, people on the globe. */
export const EARTH = {
  /** Named areas drawn over a city (Qloo answers the whole city at once: Lagos is 1,253 cells). */
  areas: 4,
  /** A scene is everything within this of the spot tapped. */
  sceneRadiusMeters: 2500,
  /** Map requests one person may make per minute. */
  perMinute: 30,
  /** The map's look: OpenFreeMap's free dark style. */
  style: "https://tiles.openfreemap.org/styles/dark",
} as const

/** The Graph (W13): a taste you can pull apart and grow. */
export const GRAPH = {
  /** Things Qloo ties to a node when it grows, per kind asked. */
  expandTake: 4,
  /** Grows one person may ask for per minute. */
  expandPerMinute: 20,
  /** When a node grows, Qloo is also asked across to one other kind of thing. */
  across: {
    "urn:entity:artist": "urn:entity:place",
    "urn:entity:place": "urn:entity:artist",
    "urn:entity:movie": "urn:entity:artist",
    "urn:entity:tv_show": "urn:entity:movie",
    "urn:entity:book": "urn:entity:movie",
    "urn:entity:podcast": "urn:entity:book",
    "urn:entity:brand": "urn:entity:place",
    "urn:entity:videogame": "urn:entity:movie",
  },
  /** Nodes drawn at most (the force layout's comfort zone). */
  maxNodes: 250,
} as const

const HOUR_S = 60 * 60

/** Images and video (generation providers, sizes, polling). */
export const MEDIA = {
  /**
   * Images run on fal when there's a fal key: FLUX 2 Edit kept the room exactly and relit it as
   * asked for about 2.4¢ (a side-by-side on the sample bedroom, 2026-10-22, beat Nano Banana,
   * Seedream 4.5 and OpenAI at 8× the price). Without a fal key, OpenAI below.
   */
  fal: {
    editModel: "fal-ai/flux-2/edit",
    model: "fal-ai/flux-2",
    /** About 1.2 megapixels: sharp on a phone, priced per megapixel. */
    sizes: {
      landscape: { width: 1344, height: 896 },
      portrait: { width: 896, height: 1344 },
      square: { width: 1088, height: 1088 },
    },
  },
  image: {
    provider: "openai",
    /** New images (a dish, a mood, an outfit): the low-cost image model. */
    model: "gpt-image-1-mini",
    /** Edits of a person's own photo: kept on the precise editor, so the room stays their room. */
    editModel: "gpt-image-2.5-sunburst",
    /** Medium quality: about a quarter of the image tokens of high, and fine on a phone. */
    quality: "medium",
    /** Images per request (one provider request, N creations). One unless the person asks. */
    variants: 1,
    size: "1536x1024",
    timeoutMs: 3 * 60 * 1000,
  },
  video: {
    /** Off until someone decides to pay for video; a fal key alone doesn't turn it on. */
    enabled: false,
    provider: "fal",
    /** FLUX 3 Max image-to-video is on promotion until 7 Nov 2026; Kling 3.0 after. */
    model: "blackforestlabs/flux-3-max/image-to-video",
    modelAfter: "fal-ai/kling-video/v3/standard/image-to-video",
    switchAt: "2026-11-07T00:00:00Z",
    seconds: 6,
    /** fal's concurrency for a new account. */
    concurrency: 2,
    startTimeoutS: 10 * 60,
  },
  /** The in-process poller checks running provider requests this often. */
  pollMs: 10_000,
  renditions: { thumb: 480, display: 1600 },
} as const

/** What one person may make per day (rule 6), plus a ceiling for the whole server. */
export const ALLOWANCE = {
  // A phone call goes out in someone's name, so guests don't make them; hotel holds are rooms
  // held for payment.
  guest: { turns: 30, images: 10, videos: 2, calls: 0, holds: 2 },
  member: { turns: 100, images: 30, videos: 6, calls: 3, holds: 6 },
  /**
   * The whole server's day, whoever is asking: a ceiling on what the paid model and image keys can
   * spend while sign-up is open to anyone. Raise it when there's budget for more.
   */
  global: { turns: 400, images: 120, videos: 20, calls: 30, holds: 60 },
  /** Guests started per IP per hour. */
  guestsPerIpPerHour: 8,
} as const

/** Taste profiles: loves, weights, words and picks (T2, rule 1). */
export const TASTE = {
  lovesMin: 3,
  lovesMax: 12,
  weightDefault: 5,
  weightMin: 1,
  weightMax: 10,
  /** Picks kept per domain on the taste page (and one Qloo page of the feed). */
  picksPerDomain: 6,
  /** Loves one taste can hold: the onboarding grid stops at `lovesMax`, the feed adds up to this. */
  seedsMax: 24,
  /** Brands read to aggregate design-language words. */
  brandsForWords: 30,
  /** Words kept per family (aesthetic, lifestyle, decor…). */
  wordsPerFamily: 8,
} as const

/** Photos people add (T5): checked, re-encoded (EXIF stripped), stored privately. */
export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  mimes: ["image/jpeg", "image/png", "image/webp"],
  /** The browser resizes to this long edge before sending (and converts HEIC to JPEG). */
  maxEdge: 2048,
  jpegQuality: 88,
} as const

/** Stories (S18): a day long, a short caption; videos up to a minute, made phone-ready. */
export const STORIES = {
  hours: 24,
  captionMax: 140,
  /** Stories one person can have up at once. */
  perPerson: 30,
  video: {
    maxBytes: 80 * 1024 * 1024,
    maxSeconds: 60,
    mimes: ["video/mp4", "video/quicktime", "video/webm"],
    /** The long edge the phone-ready copy is scaled to fit. */
    maxEdge: 1920,
  },
  /** Reactions a viewer can send with one tap. */
  reactions: ["❤️", "🔥", "😂", "😮", "😢", "👏"],
} as const

/** Object storage (RustFS, S3-compatible). One private bucket; keys are random, never per user. */
export const STORAGE = {
  bucket: "najimi",
  /** Links a provider or a share page may fetch without a session; signed, short-lived. */
  signedUrlTtlS: 6 * HOUR_S,
} as const

/**
 * Languages (T18, rule 8). Full: every string translated. Beta: shown with a tag until a native
 * speaker has checked them. Arabic is right-to-left.
 */
export const LOCALES = [
  { code: "en", name: "English", native: "English", dir: "ltr", beta: false },
  { code: "fr", name: "French", native: "Français", dir: "ltr", beta: false },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr", beta: false },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr", beta: false },
  { code: "ar", name: "Arabic", native: "العربية", dir: "rtl", beta: false },
  { code: "yo", name: "Yoruba", native: "Yorùbá", dir: "ltr", beta: true },
  { code: "ha", name: "Hausa", native: "Hausa", dir: "ltr", beta: true },
  { code: "ig", name: "Igbo", native: "Igbo", dir: "ltr", beta: true },
  { code: "sw", name: "Swahili", native: "Kiswahili", dir: "ltr", beta: true },
  { code: "hi", name: "Hindi", native: "हिन्दी", dir: "ltr", beta: true },
  { code: "zh", name: "Chinese", native: "中文", dir: "ltr", beta: true },
  { code: "ja", name: "Japanese", native: "日本語", dir: "ltr", beta: true },
] as const

export type LocaleCode = (typeof LOCALES)[number]["code"]
export const DEFAULT_LOCALE: LocaleCode = "en"

export const EMAIL = {
  from: "Najimi <najimi@konkyo.xyz>",
  /** Sign-in codes (Better Auth email OTP): six digits, ten minutes, five tries. */
  codeLength: 6,
  codeExpiresInSeconds: 10 * 60,
  codeAttempts: 5,
} as const

/**
 * The faces you can be (ported from OurSpaces, MIT, © 2026 Thomas Nguyen): one per identity
 * colour, so the face you pick is the colour your taste wears everywhere. The name is a
 * placeholder until you type your own.
 */
export const LOOKS = [
  { id: "juno", name: "Juno", identity: "violet" },
  { id: "momo", name: "Momo", identity: "pink" },
  { id: "pico", name: "Pico", identity: "orange" },
  { id: "wren", name: "Wren", identity: "cobalt" },
  { id: "ziggy", name: "Ziggy", identity: "teal" },
  { id: "pepper", name: "Pepper", identity: "butter" },
] as const
export type LookId = (typeof LOOKS)[number]["id"]
export const lookById = (id: string | null | undefined) => LOOKS.find((l) => l.id === id)

/**
 * Interface sounds (OurSpaces' set, Mixkit Sound Effects Free License): soft and short. `tap`
 * by default, `place` when something lands (a pin, a love), `check` when a result arrives,
 * `promote` for the big moments (your taste revealed).
 */
export const SOUNDS = {
  files: {
    tap: "/sounds/tap.mp3",
    place: "/sounds/place.mp3",
    check: "/sounds/check.mp3",
    promote: "/sounds/promote.mp3",
  },
  volumes: { tap: 0.34, place: 0.42, check: 0.4, promote: 0.52 },
  storageKey: "najimi:interface-sounds",
} as const
export type UiSound = keyof typeof SOUNDS.files

/** Bringing taste in from elsewhere (Letterboxd, Goodreads, Last.fm, pasted handles). */
export const IMPORTS = {
  /** Things one import offers to keep. */
  maxItems: 15,
  /** Handles one paste may hold. */
  maxHandles: 30,
  fetchTimeoutMs: 10_000,
  maxFeedBytes: 2 * 1024 * 1024,
  /** Imports one person may run per minute. */
  perMinute: 12,
  userAgent: "Mozilla/5.0 (compatible; Najimi/1.0; +https://najimi.xyz)",
} as const

/**
 * Social both ways (W14, W15). "Do it for me" acts with the person's own session, slowly and well
 * under each platform's limits (rate limits per X's and Instagram's published and observed caps),
 * and stops for the day at the first sign the platform objects.
 */
export const SOCIAL = {
  /** Most accounts one read brings back (following, likes, bookmarks). */
  readMax: 200,
  /** Candidates one connected read sends to Qloo. */
  resolveMax: 120,
  /** Tweets read from a public X timeline when someone only gives a handle. */
  timelineMax: 60,
  pacing: {
    x: { followsPerDay: 25, likesPerDay: 40, postsPerDay: 4, gapSeconds: [25, 60] },
    instagram: { followsPerDay: 15, likesPerDay: 30, postsPerDay: 2, gapSeconds: [40, 90] },
    tiktok: { followsPerDay: 0, likesPerDay: 0, postsPerDay: 2, gapSeconds: [40, 90] },
    youtube: { followsPerDay: 20, likesPerDay: 30, postsPerDay: 0, gapSeconds: [5, 15] },
  },
  /** Errors that mean "stop for today" (the platform is pushing back on this account). */
  backoffHours: 24,
  /** Connected reads one person may start per hour. */
  readsPerHour: 6,
  /** The bridge (Instagram) answers within this, or the call is given up. */
  bridgeTimeoutMs: 90_000,
  /** "Do it for me" runs at this local hour (the tune-up nudge comes first). */
  morningHour: 9,
} as const

/**
 * Business mode (W19): what a plan reads from Qloo for a business — its fans' taste across
 * kinds, where they cluster in its city, its street's scene and what's rising around it.
 */
export const BUSINESS = {
  /** The kinds of things its fans' taste is read across. */
  kinds: [
    "urn:entity:artist",
    "urn:entity:movie",
    "urn:entity:tv_show",
    "urn:entity:book",
    "urn:entity:podcast",
    "urn:entity:brand",
    "urn:entity:place",
  ],
  perKind: 8,
  /** How far from its address the business itself is looked for in Qloo (miles: /search's unit). */
  matchRadiusMiles: 5,
  /** Comparable places stand in for a business Qloo doesn't know yet. */
  comparables: 5,
  comparableRadiusMeters: 4000,
  /** How far "around it" reaches for its scene and what's rising. */
  aroundMeters: 2500,
  areas: 5,
  /** Map cells kept for the plan page. */
  cells: 400,
  /** Characters of the site's own words read. */
  siteChars: 6000,
  /** Plans one owner may build a day. */
  perDay: 6,
  /** Mondays: what changed around each business. */
  weeklyCron: "0 9 * * 1",
} as const

/**
 * The feed (W4): culture from your taste, a card at a time, music every two or three cards. Each
 * category's share is a dial (0 off … 3 more); pages come from the stored picks, then Qloo's next
 * pages for that category.
 */
export const FEED = {
  pageSize: 12,
  /**
   * Categories the feed draws from, with their share of the cards (people and destinations live
   * elsewhere). A dial scales a share: Off ×0, Less ×½, Normal ×1, More ×2.
   */
  mix: {
    artist: 5,
    podcast: 2,
    movie: 2,
    tv_show: 1,
    place: 1,
    book: 1,
    brand: 1,
    videogame: 1,
  },
  mixMax: 3,
  /** Every dial starts on Normal. */
  mixDefault: 2,
  mixFactor: [0, 0.5, 1, 2],
  /** Qloo pages one category is read to before it's done for this feed. */
  maxPages: 6,
  /** Cards seen this recently aren't shown again while there's something new. */
  seenDays: 3,
  /** A love from the feed joins the taste at this weight. */
  loveWeight: 3,
  /** Reactions go to the server in batches, at most this often. */
  flushMs: 4_000,
  /** Watching a card this long counts as interest. */
  dwellMs: 8_000,
  /** Reactions in one batch. */
  batchMax: 40,
  /** The taste is recomputed once the loves from the feed settle (pg-boss debounce, seconds). */
  retuneSeconds: 30,
  /** Feed pages one person may load per minute. */
  perMinute: 40,
  /** Cards kept mounted around the one on screen. */
  window: 3,
  /** The next page is fetched when this many cards are left. */
  prefetchAt: 4,
} as const

/**
 * Media for feed cards, looked up once and kept: Apple previews for artists (Wikidata P2850 →
 * iTunes; a name search only when Wikidata has no Apple id), a podcast's latest episode from its
 * own RSS, a film or show's trailer from TMDB. Apple's terms: stream previews, never store audio,
 * credit "courtesy of Apple" beside a store link. Only metadata is kept here.
 */
export const MEDIA_LINKS = {
  /** iTunes storefront (Nigeria's returns nothing for lookups; the US one has the catalogue). */
  country: "US",
  songsPerArtist: 3,
  /** Ids per Wikidata or iTunes request. */
  batch: 50,
  /** Name searches one request may make (iTunes allows about 20 calls a minute). */
  nameSearches: 4,
  /** Feeds read per request, and how much of each. */
  podcasts: 6,
  podcastBytes: 768 * 1024,
  trailers: 6,
  timeoutMs: 8_000,
  /** Days each answer is kept. */
  days: { appleId: 30, songs: 7, episode: 1, trailer: 30 },
  /** Apple artwork is resized in its URL. */
  artwork: 600,
  userAgent: "Najimi/1.0 (+https://najimi.xyz)",
} as const
