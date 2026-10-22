import { Disc3, Earth, type LucideIcon, UserRound, Users } from "lucide-react"

/**
 * Where you can go, shared by the phone tab bar and the desktop rail. `match` says which paths
 * light an item up (your own profile lives at /people/[id]; People itself is /people, and someone
 * else's profile /u/[username]). `orb` draws Najimi's orb instead of an icon. Sections join this
 * list as their stage lands.
 */
export type NavItem = {
  href: string
  match: (path: string) => boolean
  key: "feed" | "people" | "chat" | "earth" | "me"
  icon: LucideIcon | "orb"
}

/** The path without a locale in front ("/fr/people" → "/people"). */
const bare = (path: string) => path.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/"

export const NAV: readonly NavItem[] = [
  { href: "/feed", match: (p) => p.startsWith("/feed"), key: "feed", icon: Disc3 },
  {
    href: "/people",
    match: (p) => p === "/people" || p.startsWith("/u/"),
    key: "people",
    icon: Users,
  },
  { href: "/c", match: (p) => p === "/c" || p.startsWith("/c/"), key: "chat", icon: "orb" },
  { href: "/earth", match: (p) => p.startsWith("/earth"), key: "earth", icon: Earth },
  {
    href: "/me",
    match: (p) => p.startsWith("/me") || p.startsWith("/people/"),
    key: "me",
    icon: UserRound,
  },
]

export const isHere = (pathname: string | null, item: NavItem) =>
  Boolean(pathname && item.match(bare(pathname)))

/** Najimi's orb opens the agent sheet, except on the chat pages themselves. */
export const opensSheet = (item: NavItem, pathname: string | null) =>
  item.icon === "orb" && !isHere(pathname, item)
