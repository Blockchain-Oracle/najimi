import { DEFAULT_LOCALE } from "@najimi/config"
import { ImageResponse } from "next/og"
import { getTranslations } from "next-intl/server"
import { isLocale } from "@/lib/i18n"
import {
  creationPicture,
  imagesIn,
  OG,
  OG_HEADERS,
  OG_SIZE,
  OgChips,
  OgMark,
  ogFonts,
} from "@/lib/og"
import { identityOf } from "@/lib/people"
import { liveShare, sharedSubject } from "@/lib/shares"

/**
 * The picture a shared link unfurls into (/api/og/s/<token>, named in the page's metadata) (T19): the creation itself, a chat's title over what it
 * found, or a taste card's loves and words. A revoked or unknown link gets the plain mark.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/og/s/[token]">) {
  const { token } = await ctx.params
  const share = await liveShare(token)
  const subject = share ? await sharedSubject(share) : null
  // In the shared thing's own language (a scraper has no cookie to go by).
  const locale = subject?.locale && isLocale(subject.locale) ? subject.locale : DEFAULT_LOCALE
  const t = await getTranslations({ locale, namespace: "Share" })
  const fonts = await ogFonts()
  const frame = (children: React.ReactNode, background = OG.wall) =>
    new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background,
          fontFamily: "Plex, PlexArabic",
          color: OG.ink,
        }}
      >
        {children}
      </div>,
      { ...OG_SIZE, fonts, headers: OG_HEADERS },
    )

  if (subject?.kind === "creation") {
    const c = subject.creation
    // A video shows its poster frame.
    const key = c.kind === "image" ? (c.displayKey ?? c.s3Key) : c.posterKey
    const picture = key ? await creationPicture(key, 630, 630).catch(() => null) : null
    return frame(
      <>
        {picture ? (
          // biome-ignore lint/performance/noImgElement: next/og draws plain img elements
          <img src={picture} width={630} height={630} alt="" style={{ objectFit: "cover" }} />
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            // An explicit width: the renderer won't stretch a box beside a fixed-size image.
            width: OG_SIZE.width - 630,
            padding: 48,
            background: OG.paper,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontFamily: "Bricolage", fontSize: 54, lineHeight: 1.02 }}>
              {c.title ?? t("creationTitle")}
            </div>
            <OgChips words={c.words.slice(0, 6)} />
          </div>
          <OgMark dark />
        </div>
      </>,
    )
  }

  if (subject?.kind === "person") {
    const { person, taste, loves } = subject
    const shown = [...loves].sort((a, b) => b.weight - a.weight).slice(0, 5)
    const words = taste?.words
      ? [...(taste.words.aesthetic ?? []), ...(taste.words.ambience ?? [])].slice(0, 7)
      : []
    return frame(
      <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: 40 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            borderRadius: 28,
            overflow: "hidden",
            background: OG.paper,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: 18,
              height: 250,
              paddingBottom: 22,
              // The person's own colour as a glow, the app's aura behind it.
              background: `radial-gradient(60% 120% at 50% 0%, ${OG.identity[identityOf(person.id, person.look)] ?? OG.lime}99, transparent 75%), radial-gradient(50% 100% at 100% 100%, ${OG.identity.violet}55, transparent 70%), ${OG.paper}`,
            }}
          >
            {shown.map((l, i) =>
              l.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: next/og draws plain img elements
                <img
                  key={l.qlooId}
                  src={l.imageUrl}
                  width={130}
                  height={190}
                  alt=""
                  style={{
                    objectFit: "cover",
                    borderRadius: 14,
                    border: `4px solid ${OG.paper}`,
                    transform: `rotate(${(i - (shown.length - 1) / 2) * 6}deg)`,
                  }}
                />
              ) : null,
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              flex: 1,
              padding: "28px 40px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 820 }}>
              <div style={{ fontFamily: "Bricolage", fontSize: 56 }}>
                {t("tasteTitle", { name: person.name })}
              </div>
              <OgChips words={words} />
            </div>
            <OgMark dark />
          </div>
        </div>
      </div>,
    )
  }

  if (subject?.kind === "chat") {
    const made = subject.made.filter((c) => c.kind === "image").slice(0, 3)
    const pictures = (
      await Promise.all(
        made.map((c) =>
          creationPicture(c.thumbKey ?? c.displayKey ?? c.s3Key ?? "", 240, 300).catch(() => null),
        ),
      )
    ).filter((p): p is string => Boolean(p))
    const art = [...pictures, ...imagesIn(subject.messages, 5 - pictures.length)].slice(0, 5)
    return frame(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: 56,
        }}
      >
        <div
          style={{
            fontFamily: "Bricolage",
            fontSize: 68,
            lineHeight: 1,
            color: OG.cream,
            maxWidth: 1000,
          }}
        >
          {subject.chat.title ?? t("chatTitle")}
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {art.map((src) => (
            // biome-ignore lint/performance/noImgElement: next/og draws plain img elements
            <img
              key={src}
              src={src}
              width={190}
              height={240}
              alt=""
              style={{ objectFit: "cover", borderRadius: 16, border: `5px solid ${OG.paper}` }}
            />
          ))}
        </div>
        <OgMark />
      </div>,
    )
  }

  return frame(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 28,
        width: "100%",
        padding: 80,
      }}
    >
      <OgMark />
      <div style={{ fontFamily: "Bricolage", fontSize: 60, color: OG.cream, maxWidth: 980 }}>
        {t("pitch")}
      </div>
    </div>,
  )
}
