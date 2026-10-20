/**
 * WCAG gate: every text-on-ground pair listed in tokens.json must reach 4.5:1 in both themes.
 * Fails the build (exit 1) with the offending pairs.
 */
import { contrastRatio, parseHex, readTokens, THEMES } from "./lib.mjs"

const MIN_RATIO = 4.5
const tokens = readTokens()
const failures = []

for (const theme of THEMES) {
  const colours = tokens.themes[theme]
  for (const [text, ground] of tokens.contrast.pairs) {
    const ratio = contrastRatio(parseHex(colours[text]), parseHex(colours[ground]))
    if (ratio < MIN_RATIO) failures.push(`${theme}: ${text} on ${ground} = ${ratio.toFixed(2)}:1`)
  }
}

if (failures.length) {
  console.error(`contrast gate failed (min ${MIN_RATIO}:1):\n  ${failures.join("\n  ")}`)
  process.exit(1)
}
console.log(
  `contrast gate: ${tokens.contrast.pairs.length * THEMES.length} pairs pass ${MIN_RATIO}:1`,
)
