/** The docs site's own constants: where things live, and the words used everywhere. */

export const SITE = {
  name: "Najimi",
  title: "Najimi docs",
  /** 馴染み: someone you know well. */
  meaning: "someone you know well",
  tagline: "The group-chat agent that plans for everyone's taste.",
  description:
    "Najimi is an agent for your group chats: it reads each friend's taste through Qloo, then picks the film, plans the night and routes the trip, showing why each pick fits.",
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
