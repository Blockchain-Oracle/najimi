// MapLibre's tile worker isn't bundled by Next, so the map loads it from public/ (setWorkerUrl).
// Copied from the installed package before dev and build; public/vendor is git-ignored.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist")
const out = join(dirname(fileURLToPath(import.meta.url)), "../public/vendor")
mkdirSync(out, { recursive: true })
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), join(out, "maplibre-gl-worker.mjs"))
