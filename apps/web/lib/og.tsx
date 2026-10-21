import "server-only"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getBytes } from "@najimi/storage"
import { tokens } from "@najimi/tokens"
import sharp from "sharp"

/*
 * Link previews (T19): 1200×630 cards in Najimi's look (cream paper on the plum wall, one lime
 * pop), drawn by next/og. Fonts are read from disk once; the person's own photos are never used.
 */

export const OG_SIZE = { width: 1200, height: 630 }
/** Scrapers fetch once; a short cache keeps a stopped link's preview from lingering long. */
export const OG_HEADERS = { "cache-control": "public, max-age=600" }

const dark = tokens.themes.dark as Record<string, string>
export const OG = {
  wall: dark.background ?? "#211922",
  paper: dark.card ?? "#FFFAF7",
  ink: dark["card-foreground"] ?? "#111114",
  muted: "#5F5055",
  lime: dark.primary ?? "#C9FF3D",
  cream: dark.foreground ?? "#FFF6EE",
  identity: {
    violet: "#7853FF",
    pink: "#E9369D",
    cobalt: "#3F70FF",
    orange: "#FF7C42",
    teal: "#13B8A6",
    butter: "#FFB02E",
  } as Record<string, string>,
}

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file))
const fontsOnce = Promise.all([
  font("BricolageGrotesque-Bold.ttf"),
  font("IBMPlexSans-Regular.ttf"),
  font("IBMPlexSans-SemiBold.ttf"),
  font("IBMPlexSansArabic-SemiBold.ttf"),
])

export async function ogFonts() {
  const [display, regular, semibold, arabic] = await fontsOnce
  return [
    { name: "Bricolage", data: display, weight: 700 as const, style: "normal" as const },
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "PlexArabic", data: arabic, weight: 600 as const, style: "normal" as const },
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
            background: "rgba(17,17,20,0.07)",
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
