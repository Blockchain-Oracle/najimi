import { Disc3, type LucideIcon, UserRound } from "lucide-react"

/**
 * Where you can go, shared by the phone tab bar and the desktop rail. `match` is the path prefix
 * that lights an item up (your taste page lives at /people/[id]). `orb` draws Najimi's orb instead
 * of an icon. Sections join this list as their stage lands (Map, Circles).
 */
export type NavItem = {
  href: string
  match: string
  key: "feed" | "chat" | "me"
  icon: LucideIcon | "orb"
}

export const NAV: readonly NavItem[] = [
  { href: "/feed", match: "/feed", key: "feed", icon: Disc3 },
  { href: "/c", match: "/c", key: "chat", icon: "orb" },
  { href: "/me", match: "/people", key: "me", icon: UserRound },
]

export const isHere = (pathname: string | null, item: NavItem) =>
  Boolean(pathname?.startsWith(item.match))
