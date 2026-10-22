import sharp from "sharp"

/*
 * A person's taste colours, from the artwork of what they love: each image's most vivid colour,
 * lifted so it glows on the orb (Najimi's design: "your taste is the colour"). Best effort: an
 * image that won't load is skipped, and the defaults stand in.
 */

const FETCH_TIMEOUT_MS = 8_000
const MAX_BYTES = 5 * 1024 * 1024
const SAMPLE = 24

export type Aura = { c1: string; c2: string; c3: string }

/** The agent's own colours (tokens aura-1..3), for anyone without artwork yet. */
export const DEFAULT_AURA: Aura = { c1: "#FF4FA3", c2: "#8B5CFF", c3: "#FFB23E" }

function hsl(r: number, g: number, b: number) {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d !== 0) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
  }
  return { h: (h * 60 + 360) % 360, s, l }
}

function hex(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return `#${[r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase()
}

/** The most vivid colour of one image, lifted to glow (saturation ≥ 0.6, lightness 0.58–0.68). */
async function vividOf(url: string): Promise<{ h: number; s: number; l: number } | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(
    () => null,
  )
  if (!response?.ok) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_BYTES) return null
  const { data, info } = await sharp(bytes)
    .resize(SAMPLE, SAMPLE, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
    .catch(() => ({ data: null, info: null }))
  if (!data || !info) return null
  let best: { h: number; s: number; l: number; score: number } | null = null
  for (let i = 0; i < data.length; i += info.channels) {
    const c = hsl(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0)
    // Vivid and mid-light pixels win; near-black, near-white and grey ones barely count.
    const score = c.s * (1 - Math.abs(c.l - 0.55) * 1.6)
    if (!best || score > best.score) best = { ...c, score }
  }
  if (!best) return null
  return { h: best.h, s: Math.max(best.s, 0.6), l: Math.min(Math.max(best.l, 0.58), 0.68) }
}

/**
 * Three taste colours from up to three artworks (the heaviest loves first). When two land on the
 * same hue, the second is turned 40° so the orb still has depth; missing ones use the defaults.
 */
export async function auraFrom(images: string[]): Promise<Aura> {
  const found = (await Promise.all(images.slice(0, 3).map(vividOf))).filter(
    (c): c is { h: number; s: number; l: number } => c !== null,
  )
  if (!found.length) return DEFAULT_AURA
  const spread = found.map((c, i) => {
    const clash = found.slice(0, i).some((p) => Math.abs(p.h - c.h) < 25)
    return clash ? { ...c, h: (c.h + 40 * i) % 360 } : c
  })
  const [a, b, c] = spread
  const first = a ?? { h: 330, s: 0.8, l: 0.62 }
  return {
    c1: hex(first.h, first.s, first.l),
    c2: hex((b ?? { ...first, h: (first.h + 50) % 360 }).h, (b ?? first).s, (b ?? first).l),
    c3: hex((c ?? { ...first, h: (first.h + 110) % 360 }).h, (c ?? first).s, (c ?? first).l),
  }
}
