/** @jsxRuntime automatic */
/** @jsxImportSource react */
/*
 * The README's banner and demo cover, drawn from real captures of the product
 * (.github/assets/captures, phone screens of the live app) with the app's own fonts and colours.
 * Run: pnpm --filter @najimi/web exec tsx scripts/readme-art/make.tsx
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"

const ROOT = join(import.meta.dirname, "../../../..")
const FONTS = join(import.meta.dirname, "../../assets/fonts")
const C = {
  wall: "#211922",
  paper: "#FFFAF7",
  ink: "#111114",
  cream: "#FFF6EE",
  lime: "#C9FF3D",
  muted: "#B4A9B1",
}

const capture = async (name: string) =>
  `data:image/jpeg;base64,${(await readFile(join(ROOT, ".github/assets/captures", `${name}.jpg`))).toString("base64")}`

async function fonts() {
  const read = (dir: string, file: string) => readFile(join(dir, file))
  return [
    {
      name: "Bricolage",
      data: await read(FONTS, "BricolageGrotesque-Bold.ttf"),
      weight: 700 as const,
    },
    { name: "Plex", data: await read(FONTS, "IBMPlexSans-Regular.ttf"), weight: 400 as const },
    { name: "Plex", data: await read(FONTS, "IBMPlexSans-SemiBold.ttf"), weight: 600 as const },
    // Only 馴染み: a three-character subset of Noto Sans JP (OFL).
    {
      name: "NotoJP",
      data: await read(import.meta.dirname, "NotoSansJP-Bold-najimi.ttf"),
      weight: 700 as const,
    },
  ]
}

/** A phone screen: the capture's top, in a dark rounded frame. */
function Phone({
  src,
  width,
  tilt,
  lift = 0,
}: {
  src: string
  width: number
  tilt: number
  lift?: number
}) {
  const height = Math.round(width * 1.9)
  return (
    <div
      style={{
        display: "flex",
        width: width + 20,
        height: height + 20,
        padding: 10,
        borderRadius: 44,
        background: "#0B0B0E",
        border: "2px solid rgba(255,255,255,0.12)",
        transform: `rotate(${tilt}deg) translateY(${lift}px)`,
        boxShadow: "0 18px 0 rgba(0,0,0,0.35)",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: next/og draws plain img elements */}
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        style={{ borderRadius: 34, objectFit: "cover", objectPosition: "top" }}
      />
    </div>
  )
}

async function banner() {
  const [landing, taste, chat] = await Promise.all([
    capture("landing"),
    capture("taste"),
    capture("chat"),
  ])
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: C.wall,
        fontFamily: "Plex",
        color: C.cream,
        padding: "0 96px",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 28, width: 760 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              width: 26,
              height: 26,
              borderRadius: 999,
              background: C.lime,
            }}
          />
          <div style={{ fontFamily: "Bricolage", fontSize: 52 }}>najimi</div>
          <div style={{ fontFamily: "NotoJP", fontSize: 40, color: C.muted }}>馴染み</div>
        </div>
        <div
          style={{ fontFamily: "Bricolage", fontSize: 118, lineHeight: 0.98, letterSpacing: -4 }}
        >
          The taste copilot.
        </div>
        <div style={{ fontSize: 34, lineHeight: 1.35, color: "#DCD2D9" }}>
          Tell it three things you love. It reads your taste through Qloo, then makes things for
          your real life that fit you.
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <div
            style={{
              display: "flex",
              padding: "12px 26px",
              borderRadius: 999,
              background: C.lime,
              color: C.ink,
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            Built on Qloo
          </div>
          <div
            style={{
              display: "flex",
              padding: "12px 26px",
              borderRadius: 999,
              border: "2px solid rgba(255,246,238,0.3)",
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            12 languages
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <Phone src={taste} width={300} tilt={-6} lift={40} />
        <div style={{ display: "flex", marginLeft: -40, marginRight: -40 }}>
          <Phone src={chat} width={330} tilt={0} />
        </div>
        <Phone src={landing} width={300} tilt={6} lift={40} />
      </div>
    </div>,
    { width: 1920, height: 960, fonts: await fonts() },
  )
}

async function cover() {
  const chat = await capture("chat")
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: C.wall,
        fontFamily: "Plex",
        color: C.cream,
        alignItems: "center",
        justifyContent: "center",
        gap: 120,
      }}
    >
      <Phone src={chat} width={420} tilt={-3} />
      <div style={{ display: "flex", flexDirection: "column", gap: 36, width: 760 }}>
        <div style={{ fontFamily: "Bricolage", fontSize: 92, lineHeight: 1, letterSpacing: -3 }}>
          Watch Najimi relight a room.
        </div>
        <div style={{ fontSize: 34, color: "#DCD2D9", lineHeight: 1.35 }}>
          Three loves, a taste from Qloo, a photo restyled, a lighting plan, real lamps and a
          soundtrack.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              width: 150,
              height: 150,
              borderRadius: 999,
              background: C.lime,
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 0 rgba(0,0,0,0.35)",
            }}
          >
            <svg width="64" height="72" viewBox="0 0 64 72" style={{ marginLeft: 12 }} aria-hidden>
              <path d="M0 0 L64 36 L0 72 Z" fill={C.ink} />
            </svg>
          </div>
          <div style={{ fontFamily: "Bricolage", fontSize: 44 }}>Play the demo</div>
        </div>
      </div>
    </div>,
    { width: 1920, height: 1080, fonts: await fonts() },
  )
}

async function main() {
  const out = [
    [await banner(), join(ROOT, ".github/assets/banner.png")],
    [await cover(), join(import.meta.dirname, "../../public/demo/cover.png")],
  ] as const
  for (const [image, path] of out) {
    await writeFile(path, Buffer.from(await image.arrayBuffer()))
    console.log("wrote", path)
  }
}

main()
