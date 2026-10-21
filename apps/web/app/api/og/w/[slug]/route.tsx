import { DEFAULT_LOCALE } from "@najimi/config"
import { ImageResponse } from "next/og"
import { getTranslations } from "next-intl/server"
import { isLocale } from "@/lib/i18n"
import { OG, OG_HEADERS, OG_SIZE, OgMark, ogFonts } from "@/lib/og"
import { isBuiltIn, runnableWorkflow } from "@/lib/workflows"

/** Built-in workflows wear their own colour; saved ones the lime. */
const TONE: Record<string, string> = {
  "relight-my-room": OG.identity.butter ?? OG.lime,
  "make-it-mine": OG.identity.pink ?? OG.lime,
  "cook-for": OG.identity.orange ?? OG.lime,
  "next-read": OG.identity.teal ?? OG.lime,
  "dress-me": OG.identity.violet ?? OG.lime,
  "my-taste-film": OG.identity.cobalt ?? OG.lime,
  "night-in": OG.lime,
}

/** A workflow link's preview (T15): its name and what it gives, on its colour. */
export async function GET(request: Request, ctx: RouteContext<"/api/og/w/[slug]">) {
  const { slug } = await ctx.params
  const w = await runnableWorkflow(null, slug)
  const asked = new URL(request.url).searchParams.get("l") ?? ""
  const locale = isLocale(asked) ? asked : DEFAULT_LOCALE
  const t = await getTranslations({ locale, namespace: "Workflows" })
  const name = w
    ? isBuiltIn(w)
      ? t(`items.${w.slug}.name` as "items.night-in.name")
      : w.name
    : "Najimi"
  const description = w
    ? isBuiltIn(w)
      ? t(`items.${w.slug}.desc` as "items.night-in.desc")
      : w.description
    : ""
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 40,
        background: OG.wall,
        fontFamily: "Plex, PlexArabic",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          borderRadius: 28,
          overflow: "hidden",
          background: OG.paper,
          color: OG.ink,
        }}
      >
        <div style={{ display: "flex", height: 150, background: TONE[slug] ?? OG.lime }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "36px 48px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontFamily: "Bricolage", fontSize: 72, lineHeight: 1 }}>{name}</div>
            <div style={{ fontSize: 30, color: OG.muted, maxWidth: 1000 }}>{description}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <OgMark dark />
            <div
              style={{
                display: "flex",
                padding: "12px 28px",
                borderRadius: 999,
                background: OG.lime,
                fontSize: 28,
                fontWeight: 600,
              }}
            >
              {t("runThis")}
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await ogFonts(), headers: OG_HEADERS },
  )
}
