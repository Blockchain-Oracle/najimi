import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons"

/**
 * The four feeds, each with the one colour it's allowed on the page (its own brand's, as a glow
 * behind its card) and how Najimi reaches it: X and Instagram connect with your session; TikTok
 * and YouTube come in from your data export.
 */
export const PLATFORMS = [
  { id: "x", icon: siX, name: "X", glow: "#e7e9ea", reach: "session" },
  { id: "instagram", icon: siInstagram, name: "Instagram", glow: "#e1306c", reach: "session" },
  { id: "tiktok", icon: siTiktok, name: "TikTok", glow: "#fe2c55", reach: "export" },
  { id: "youtube", icon: siYoutube, name: "YouTube", glow: "#ff0033", reach: "export" },
] as const

export type Platform = (typeof PLATFORMS)[number]["id"]
export type Live = "x" | "instagram"
export const platformOf = (id: Platform) => PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0]

/** Qloo artwork comes at a size named in its URL. */
export const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

export const zone = () =>
  typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone
