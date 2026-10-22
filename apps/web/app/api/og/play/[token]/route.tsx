import { DEFAULT_LOCALE } from "@najimi/config"
import { roundView } from "@najimi/games/round"
import { tokens } from "@najimi/tokens"
import { ImageResponse } from "next/og"
import { getTranslations } from "next-intl/server"
import { funnelFonts, OG_HEADERS, OG_SIZE } from "@/lib/og"

/*
 * A challenge link's picture (/api/og/play/<token>): the round's things fanned like a hand of
 * cards on black, the game's name, and whose taste it is. Answers never show.
 */

const dark = tokens.themes.dark as Record<string, string>
const C = {
  wall: dark.background ?? "#000000",
  ink: dark.foreground ?? "#F5F5F7",
  muted: dark["text-3"] ?? "#8E8E96",
  signal: dark.signal ?? "#FF5CA8",
  aura: [dark["aura-1"] ?? "#FF4FA3", dark["aura-2"] ?? "#8B5CFF", dark["aura-3"] ?? "#FFB23E"],
}

const sized = (url: string | null) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, "-320x-auto.") : url

export async function GET(_request: Request, ctx: RouteContext<"/api/og/play/[token]">) {
  const { token } = await ctx.params
  const view = /^[a-z0-9]{8,32}$/.test(token) ? await roundView(token, null) : null
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: "Games" })
  const fonts = await funnelFonts()
  const pictures = (view?.items ?? [])
    .map((it) => sized(it.image ?? it.options?.find((o) => o.image)?.image ?? null))
    .filter((u): u is string => Boolean(u))
    .slice(0, 5)
  const about =
    view?.subject && view.kind !== "blind" && view.kind !== "twins" ? view.subject.name : null
  const n = pictures.length
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: `radial-gradient(90% 120% at 85% 10%, ${C.aura[1]}55, transparent 60%), radial-gradient(70% 90% at 100% 100%, ${C.signal}44, transparent 60%), ${C.wall}`,
        color: C.ink,
        fontFamily: "Funnel Sans",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 560,
          padding: "64px 0 64px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            fontFamily: "Funnel Display",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: C.signal,
              display: "flex",
            }}
          />
          najimi
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontFamily: "Funnel Display",
              fontSize: 76,
              lineHeight: 0.98,
              letterSpacing: -2,
            }}
          >
            {view?.title ?? t("kinds.wavelength")}
          </div>
          {about ? (
            <div style={{ fontSize: 34, fontWeight: 600, color: C.muted }}>
              {t("about", { name: about })}
            </div>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "14px 26px",
            borderRadius: 999,
            background: C.ink,
            color: C.wall,
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          {t("vs")} Najimi · {t("play")}
        </div>
      </div>
      <div style={{ display: "flex", position: "relative", flex: 1 }}>
        {pictures.map((src, i) => {
          const d = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0
          return (
            // biome-ignore lint/performance/noImgElement: next/og draws plain img elements
            <img
              key={src}
              src={src}
              width={230}
              height={310}
              alt=""
              style={{
                position: "absolute",
                left: 175 + d * 150,
                top: 150 + Math.abs(d) * Math.abs(d) * 30,
                objectFit: "cover",
                borderRadius: 28,
                transform: `rotate(${d * 16}deg)`,
                boxShadow: "0 30px 60px rgba(0,0,0,0.55)",
                border: "2px solid rgba(255,255,255,0.12)",
              }}
            />
          )
        })}
      </div>
    </div>,
    { ...OG_SIZE, fonts, headers: OG_HEADERS },
  )
}
