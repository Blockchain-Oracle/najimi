import "server-only"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getBytes } from "@najimi/storage"
import { tokens } from "@najimi/tokens"
import sharp from "sharp"

/*
 * Link previews: 1200×630 cards in Najimi's look (black, the aura's glow, Funnel type), drawn by
 * next/og. Fonts are read from disk once; the person's own photos are never used.
 */

export const OG_SIZE = { width: 1200, height: 630 }
/** Scrapers fetch once; a short cache keeps a stopped link's preview from lingering long. */
export const OG_HEADERS = { "cache-control": "public, max-age=600" }

const dark = tokens.themes.dark as Record<string, string>
/** The roles the older previews were drawn with, now the app's own dark theme. */
export const OG = {
  wall: dark.background ?? "#000000",
  paper: dark.card ?? "#131315",
  ink: dark.foreground ?? "#F5F5F7",
  muted: dark["text-3"] ?? "#8E8E96",
  lime: dark.signal ?? "#FF5CA8",
  cream: dark.foreground ?? "#F5F5F7",
  identity: {
    violet: dark["aura-2"] ?? "#8B5CFF",
    pink: dark["aura-1"] ?? "#FF4FA3",
    cobalt: dark["aura-2"] ?? "#8B5CFF",
    orange: dark["aura-3"] ?? "#FFB23E",
    teal: dark["aura-1"] ?? "#FF4FA3",
    butter: dark["aura-3"] ?? "#FFB23E",
  } as Record<string, string>,
}

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file))
const fontsOnce = Promise.all([
  font("BricolageGrotesque-Bold.ttf"),
  font("IBMPlexSans-Regular.ttf"),
  font("IBMPlexSans-SemiBold.ttf"),
  font("IBMPlexSansArabic-SemiBold.ttf"),
])

/**
 * The older previews' font names, carrying the app's own faces now: "Bricolage" titles are Funnel
 * Display, "Plex" text is Funnel Sans (Plex Arabic stays for Arabic, which Funnel doesn't cover).
 */
export async function ogFonts() {
  const [[, , , arabic], [display, regular, semibold]] = await Promise.all([fontsOnce, funnelOnce])
  return [
    { name: "Bricolage", data: display, weight: 700 as const, style: "normal" as const },
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "PlexArabic", data: arabic, weight: 600 as const, style: "normal" as const },
  ]
}

const funnelOnce = Promise.all([
  font("FunnelDisplay-ExtraBold.woff"),
  font("FunnelSans-Regular.woff"),
  font("FunnelSans-SemiBold.woff"),
])

/** The app's own faces (Funnel Display titles, Funnel Sans text) for previews in the new look. */
export async function funnelFonts() {
  const [display, regular, semibold] = await funnelOnce
  return [
    { name: "Funnel Display", data: display, weight: 800 as const, style: "normal" as const },
    { name: "Funnel Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Funnel Sans", data: semibold, weight: 600 as const, style: "normal" as const },
  ]
}

/** A stored creation as a JPEG data URL sized for the card (the renderer reads JPEG and PNG). */
export async function creationPicture(key: string, width: number, height: number) {
  const bytes = await getBytes(key)
  const jpeg = await sharp(bytes)
    .resize(width, height, { fit: "cover" })
    .jpeg({ quality: 82 })
    .toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`
}

/** Image links Qloo gave inside saved tool results (artwork for a chat's preview). */
export function imagesIn(value: unknown, limit: number): string[] {
  const found: string[] = []
  const walk = (v: unknown) => {
    if (found.length >= limit || v === null || typeof v !== "object") return
    if (Array.isArray(v)) {
      for (const x of v) walk(x)
      return
    }
    for (const [k, x] of Object.entries(v)) {
      if ((k === "image" || k === "imageUrl") && typeof x === "string" && x.startsWith("https://"))
        found.includes(x) || found.push(x)
      else walk(x)
    }
  }
  walk(value)
  return found.slice(0, limit)
}

/** The brand mark every preview carries. */
export function OgMark({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "Bricolage",
        fontSize: 34,
        color: dark ? OG.ink : OG.cream,
      }}
    >
      <div
        style={{ width: 22, height: 22, borderRadius: 999, background: OG.lime, display: "flex" }}
      />
      najimi
    </div>
  )
}

/** Word chips on paper, the way the app shows a taste. */
export function OgChips({ words }: { words: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {words.map((w) => (
        <div
          key={w}
          style={{
            display: "flex",
            padding: "8px 18px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            fontSize: 24,
            fontWeight: 600,
            color: OG.ink,
          }}
        >
          {w}
        </div>
      ))}
    </div>
  )
}
