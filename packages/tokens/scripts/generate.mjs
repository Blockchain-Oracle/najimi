/**
 * tokens.json → generated/tokens.css (custom properties: light on :root, dark when the device
 * prefers it unless `.light` is set, and always under `.dark`),
 * generated/theme.css (a Tailwind v4 `@theme inline` bridge) and generated/tokens.ts.
 * Run through `pnpm --filter @najimi/tokens build`; never edit generated/ by hand.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { readTokens, THEMES } from "./lib.mjs"

const tokens = readTokens()
const out = new URL("../generated/", import.meta.url)
mkdirSync(out, { recursive: true })

const HEADER = "/* Generated from packages/tokens/tokens.json — do not edit. */\n"

const colourBlock = (theme) =>
  Object.entries(tokens.themes[theme])
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n")

const scalars = [
  ...Object.entries(tokens.radius).map(([k, v]) => `  --n-radius-${k}: ${v};`),
  ...Object.entries(tokens.motion).map(([k, v]) => `  --motion-${k}: ${v};`),
  `  --tracking-ui: ${tokens.tracking.ui};`,
  `  --tracking-display: ${tokens.tracking.display};`,
].join("\n")

const css = `${HEADER}
:root {
  color-scheme: light;
${colourBlock("light")}
${scalars}
}

@media (prefers-color-scheme: dark) {
  :root:not(.light) {
    color-scheme: dark;
${colourBlock("dark").replaceAll("\n  ", "\n    ").replace(/^ {2}/, "    ")}
  }
}

.dark {
  color-scheme: dark;
${colourBlock("dark")}
}
`

const colourKeys = Object.keys(tokens.themes.light)
const theme = `${HEADER}
@theme inline {
${colourKeys.map((key) => `  --color-${key}: var(--${key});`).join("\n")}
${Object.entries(tokens.font)
  .map(([k, v]) => `  --font-${k}: ${v};`)
  .join("\n")}
${Object.entries(tokens.text)
  .map(([k, [size, lh]]) => `  --text-${k}: ${size};\n  --text-${k}--line-height: ${lh};`)
  .join("\n")}
${Object.keys(tokens.radius)
  .map((k) => `  --radius-${k}: var(--n-radius-${k});`)
  .join("\n")}
  --radius-lg: var(--n-radius-card);
  --radius-md: var(--n-radius-card);
  --radius-xl: var(--n-radius-card);
}
`

const ts = `// Generated from packages/tokens/tokens.json — do not edit.
export const tokens = ${JSON.stringify(
  {
    defaultMode: tokens.defaultMode,
    themes: Object.fromEntries(THEMES.map((t) => [t, tokens.themes[t]])),
    radius: tokens.radius,
    motion: tokens.motion,
  },
  null,
  2,
)} as const
`

writeFileSync(new URL("tokens.css", out), css)
writeFileSync(new URL("theme.css", out), theme)
writeFileSync(new URL("tokens.ts", out), ts)
console.log(`tokens: ${colourKeys.length} colours × ${THEMES.length} themes → generated/`)
