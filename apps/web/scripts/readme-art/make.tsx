/** @jsxRuntime automatic */
/** @jsxImportSource react */
/*
 * The README's banner, drawn from real captures of the app (.github/assets/captures, phone
 * screens) in its own look: the black wall, the aura's glow, Funnel type, and the Najimi | Qloo
 * lockup with Qloo's own wordmark.
 * Run: pnpm --filter @najimi/web exec tsx scripts/readme-art/make.tsx
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { QLOO_MARK } from "../../components/brands/qloo-logo"

const ROOT = join(import.meta.dirname, "../../../..")
const FONTS = join(import.meta.dirname, "../../assets/fonts")
const C = {
  wall: "#000000",
  ink: "#F5F5F7",
  muted: "#8E8E96",
  signal: "#FF5CA8",
  aura: ["#FF4FA3", "#8B5CFF", "#FFB23E"],
}
const SIZE = { width: 1600, height: 800 }

const capture = async (name: string) =>
  `data:image/jpeg;base64,${(await readFile(join(ROOT, ".github/assets/captures", `${name}.jpg`))).toString("base64")}`

async function fonts() {
  const read = (dir: string, file: string) => readFile(join(dir, file))
  return [
    {
      name: "Funnel Display",
      data: await read(FONTS, "FunnelDisplay-ExtraBold.woff"),
      weight: 800 as const,
    },
    {
      name: "Funnel Sans",
      data: await read(FONTS, "FunnelSans-Regular.woff"),
      weight: 400 as const,
    },
    {
      name: "Funnel Sans",
      data: await read(FONTS, "FunnelSans-SemiBold.woff"),
      weight: 600 as const,
    },
    // Only 馴染み: a three-character subset of Noto Sans JP (OFL).
    {
      name: "NotoJP",
      data: await read(import.meta.dirname, "NotoSansJP-Bold-najimi.ttf"),
      weight: 700 as const,
    },
  ]
}

function Qloo({ height }: { height: number }) {
  return (
    <svg
      width={height * QLOO_MARK.ratio}
      height={height}
      viewBox={QLOO_MARK.viewBox}
      role="img"
      aria-label="Qloo"
    >
      {QLOO_MARK.ink.map((d) => (
        <path key={d} d={d} fill={C.ink} />
      ))}
      <path d={QLOO_MARK.bar} fill={QLOO_MARK.accent} />
    </svg>
  )
}

/** A phone: the capture's top in a dark frame, turned a little. */
function Phone({
  src,
  width,
  tilt,
  x,
  y,
}: {
  src: string
  width: number
  tilt: number
  x: number
  y: number
}) {
  const height = Math.round(width * 2.05)
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        display: "flex",
        width,
        height,
        padding: 7,
        borderRadius: 40,
        background: "#111113",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 40px 90px -30px rgba(139,92,255,0.55)",
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/og renders plain img */}
      <img
        src={src}
        alt=""
        width={width - 14}
        height={height - 14}
        style={{ borderRadius: 33, objectFit: "cover", objectPosition: "top" }}
      />
    </div>
  )
}

async function banner() {
  const [feed, earth, game, business, graph] = await Promise.all([
    capture("feed"),
    capture("earth"),
    capture("game"),
    capture("business"),
    capture("graph"),
  ])
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: `radial-gradient(60% 80% at 78% 40%, ${C.aura[1]}55, transparent 70%), radial-gradient(45% 60% at 62% 85%, ${C.aura[0]}44, transparent 70%), radial-gradient(35% 45% at 95% 5%, ${C.aura[2]}33, transparent 70%), ${C.wall}`,
        color: C.ink,
        fontFamily: "Funnel Sans",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 720,
          padding: "72px 0 72px 88px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              background: C.signal,
              display: "flex",
            }}
          />
          <div style={{ display: "flex", fontFamily: "Funnel Display" }}>najimi</div>
          <div style={{ display: "flex", fontFamily: "NotoJP", fontSize: 30, color: C.muted }}>
            馴染み
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Funnel Display",
              fontSize: 92,
              lineHeight: 0.98,
              letterSpacing: -2,
            }}
          >
            Find your people by what you love.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: C.muted, lineHeight: 1.3 }}>
            Your taste as a feed, a map, games and plans, with an AI agent in every chat.
          </div>
        </div>
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 600 }}
        >
          <div style={{ display: "flex", color: C.muted }}>Built on</div>
          <Qloo height={30} />
        </div>
      </div>
      <Phone src={earth} width={250} tilt={-10} x={790} y={150} />
      <Phone src={graph} width={250} tilt={9} x={1330} y={170} />
      <Phone src={game} width={260} tilt={-4} x={960} y={110} />
      <Phone src={business} width={260} tilt={5} x={1170} y={120} />
      <Phone src={feed} width={280} tilt={0} x={1060} y={60} />
    </div>,
    { ...SIZE, fonts: await fonts() },
  )
}

async function main() {
  const path = join(ROOT, ".github/assets/banner.png")
  await writeFile(path, Buffer.from(await (await banner()).arrayBuffer()))
  console.log("wrote", path)
}

main()
