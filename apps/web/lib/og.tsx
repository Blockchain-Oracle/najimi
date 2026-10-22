import "server-only"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getBytes } from "@najimi/storage"
import { tokens } from "@najimi/tokens"
import { ImageResponse } from "next/og"
import sharp from "sharp"
import { QLOO_MARK } from "@/components/brands/qloo-logo"

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

/** Qloo's wordmark, drawn by next/og (the same paths as the app's QlooLogo). */
export function OgQloo({ height, color = OG.ink }: { height: number; color?: string }) {
  return (
    <svg
      width={height * QLOO_MARK.ratio}
      height={height}
      viewBox={QLOO_MARK.viewBox}
      role="img"
      aria-label="Qloo"
    >
      {QLOO_MARK.ink.map((d) => (
        <path key={d} d={d} fill={color} />
      ))}
      <path d={QLOO_MARK.bar} fill={QLOO_MARK.accent} />
    </svg>
  )
}

/** The brand mark every preview carries: Najimi, and the Qloo it's built on. */
export function OgMark({ dark = false }: { dark?: boolean }) {
  const color = dark ? OG.ink : OG.cream
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: "Bricolage",
        fontSize: 34,
        color,
      }}
    >
      <div
        style={{ width: 22, height: 22, borderRadius: 999, background: OG.lime, display: "flex" }}
      />
      najimi
      <div
        style={{ width: 2, height: 30, marginLeft: 6, background: `${color}33`, display: "flex" }}
      />
      <OgQloo height={24} color={color} />
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

/**
 * A link card in the app's look: a title, one line, a few word chips on the left; up to three
 * pieces of artwork fanned on the right; the Najimi | Qloo mark. For business plans and invites.
 */
export async function ogCard(input: {
  title: string
  line: string
  chips: string[]
  images: (string | null)[]
}) {
  const art = input.images.filter((i): i is string => Boolean(i)).slice(0, 3)
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: `radial-gradient(60% 90% at 85% 30%, ${OG.identity.violet}55, transparent 70%), radial-gradient(40% 60% at 70% 95%, ${OG.identity.pink}40, transparent 70%), ${OG.wall}`,
        color: OG.ink,
        fontFamily: "Funnel Sans",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 640,
          padding: "56px 0 52px 64px",
        }}
      >
        <OgMark />
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Funnel Display",
              fontSize: 68,
              lineHeight: 1,
              letterSpacing: -1.5,
            }}
          >
            {input.title}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: OG.muted }}>{input.line}</div>
          {input.chips.length ? <OgChips words={input.chips.slice(0, 5)} /> : null}
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", width: 560, height: "100%" }}>
        {art.map((src, i) => (
          // biome-ignore lint/performance/noImgElement: next/og draws plain img elements
          <img
            key={src}
            src={src}
            alt=""
            width={230}
            height={300}
            style={{
              position: "absolute",
              left: 60 + i * 120,
              top: 150 - (i === 1 ? 40 : 0),
              borderRadius: 28,
              objectFit: "cover",
              transform: `rotate(${(i - 1) * 7}deg)`,
              border: "2px solid rgba(255,255,255,0.12)",
            }}
          />
        ))}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await funnelFonts(), headers: OG_HEADERS },
  )
}
