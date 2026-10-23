/** The docs site's own constants: where things live, and the words used everywhere. */

export const SITE = {
  name: "Najimi",
  title: "Najimi docs",
  /** 馴染み: someone you know well. */
  meaning: "someone you know well",
  tagline: "Your taste, made social, with an agent that plans for everyone.",
  description:
    "Najimi is a social taste app. Through Qloo, what you love becomes a feed, friends, games and a map, and Najimi, the agent in every chat, plans nights and trips for everyone's taste, showing why each pick fits.",
  url: "https://docs.najimi.xyz",
  app: "https://najimi.xyz",
  appStart: "https://najimi.xyz/start",
  repo: "https://github.com/Blockchain-Oracle/najimi",
  qloo: "https://www.qloo.com",
} as const

/** Where the docs start, and the first page of each section (the top tabs). */
export const DOCS = {
  base: "/docs",
  start: "/docs/guide",
  agent: "/docs/agent",
  qloo: "/docs/qloo",
  build: "/docs/build",
} as const

/** Link previews: one size for every page. */
export const OG = { width: 1200, height: 630 } as const
