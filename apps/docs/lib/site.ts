/** The docs site's own constants: where things live, and the words used everywhere. */

export const SITE = {
  name: "Najimi",
  title: "Najimi docs",
  /** 馴染み: someone you know well. */
  meaning: "someone you know well",
  tagline: "Find your people by what you love.",
  description:
    "Najimi is a social app where your taste is your identity, built on Qloo's taste graph, with an agent in every chat that plans, plays, calls and books for you.",
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
