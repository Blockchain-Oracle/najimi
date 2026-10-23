import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import { QLOO_MARK } from "@/components/qloo-logo"
import { OG, SITE } from "./site"

/*
 * Link previews in the app's look (apps/web/lib/og.tsx): black, the agent's aura glowing behind,
 * Funnel Display for the title, Qloo's wordmark. Drawn once at build; fonts read from disk so the
 * Docker build needs no network for them.
 */

const INK = "#F5F5F7"
const MUTED = "#8E8E96"
const AURA = ["#FF4FA3", "#8B5CFF", "#FFB23E"] as const

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file))
const fontsOnce = Promise.all([
  font("FunnelDisplay-ExtraBold.woff"),
  font("FunnelSans-Regular.woff"),
  font("FunnelSans-SemiBold.woff"),
])

async function fonts() {
  const [display, regular, semibold] = await fontsOnce
  return [
    { name: "Funnel Display", data: display, weight: 800 as const, style: "normal" as const },
    { name: "Funnel Sans", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Funnel Sans", data: semibold, weight: 600 as const, style: "normal" as const },
  ]
}

function QlooMark({ height }: { height: number }) {
  return (
    <svg
      width={height * QLOO_MARK.ratio}
      height={height}
      viewBox={QLOO_MARK.viewBox}
      role="img"
      aria-label="Qloo"
    >
      {QLOO_MARK.ink.map((d) => (
        <path key={d} d={d} fill={INK} />
      ))}
      <path d={QLOO_MARK.bar} fill={QLOO_MARK.accent} />
    </svg>
  )
}

/** A preview card: a kicker (the section), the title, a line of description. */
export async function ogImage({
  kicker,
  title,
  description,
}: {
  kicker: string
  title: string
  description?: string
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#000",
        backgroundImage: `radial-gradient(circle at 86% 18%, ${AURA[0]}55 0%, transparent 34%), radial-gradient(circle at 96% 62%, ${AURA[1]}66 0%, transparent 38%), radial-gradient(circle at 74% 96%, ${AURA[2]}44 0%, transparent 32%)`,
        color: INK,
        fontFamily: "Funnel Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            // next/og draws no conic gradients: the orb is three soft lights on violet.
            backgroundColor: AURA[1],
            backgroundImage: `radial-gradient(circle at 28% 30%, ${AURA[0]} 0%, transparent 58%), radial-gradient(circle at 72% 78%, ${AURA[2]} 0%, transparent 55%)`,
          }}
        />
        <span style={{ fontFamily: "Funnel Display", fontSize: 34, letterSpacing: -0.6 }}>
          {SITE.name}
        </span>
        <span style={{ width: 2, height: 30, background: "#333", margin: "0 6px" }} />
        <span style={{ fontSize: 24, color: MUTED, fontWeight: 600 }}>{kicker}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 900 }}>
        <span
          style={{
            fontFamily: "Funnel Display",
            fontSize: title.length > 34 ? 70 : 86,
            lineHeight: 1.0,
            letterSpacing: -2.2,
          }}
        >
          {title}
        </span>
        {description ? (
          <span style={{ fontSize: 30, lineHeight: 1.3, color: "#C4C4CC" }}>{description}</span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: MUTED }}>
        <span>Built on</span>
        <QlooMark height={24} />
        <span style={{ marginLeft: "auto" }}>docs.najimi.xyz</span>
      </div>
    </div>,
    { ...OG, fonts: await fonts() },
  )
}
