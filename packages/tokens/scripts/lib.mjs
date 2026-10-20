/**
 * Shared helpers for the token generator and the contrast gate (adapted from Zecathon's tokens).
 * Pure functions over tokens.json; no third-party dependencies.
 */
import { readFileSync } from "node:fs"

export const TOKENS_URL = new URL("../tokens.json", import.meta.url)
export const THEMES = ["light", "dark"]

export function readTokens() {
  return JSON.parse(readFileSync(TOKENS_URL, "utf8"))
}

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i

export function parseHex(hex) {
  const match = HEX.exec(hex)
  if (!match) throw new Error(`Not a #RRGGBB or #RRGGBBAA colour: ${hex}`)
  const [, rgb, alpha] = match
  const value = Number.parseInt(rgb, 16)
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
    a: alpha === undefined ? 1 : Number.parseInt(alpha, 16) / 0xff,
  }
}

function channel(value) {
  const c = value / 0xff
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 2.x relative luminance. */
export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}
