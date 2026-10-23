import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { tokens } from "@najimi/tokens"
import { ImageResponse } from "next/og"
import { funnelFonts, OG_HEADERS, OG_SIZE, OgQloo } from "@/lib/og"
import { WRAPPED_SLIDES as SLIDES, type Wrapped, wrappedOf } from "@/lib/passport"
import { liveShare } from "@/lib/shares"

/*
 * The Wrapped story set (W22): five 9:16 slides (1080×1920, for Stories and Status) drawn on the
 * server, and a landscape card for link previews. What you see in the app is exactly what's
 * shared. After Airbuds' recap (Refero ac0fa41e): big ghost type, ranked portraits, a "join me"
 * footer; colours are the app's own aura, nothing else.
 */

const dark = tokens.themes.dark as Record<string, string>
const C = {
  wall: dark.background ?? "#000000",
  ink: dark.foreground ?? "#F5F5F7",
  muted: dark["text-3"] ?? "#8E8E96",
  card: dark.card ?? "#131315",
  signal: dark.signal ?? "#FF5CA8",
  aura: [dark["aura-1"] ?? "#FF4FA3", dark["aura-2"] ?? "#8B5CFF", dark["aura-3"] ?? "#FFB23E"],
}
const STORY = { width: 1080, height: 1920 }

const sized = (url: string | null, w: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${w}x-auto.`) : url

async function lookOf(look: string | null) {
  if (!look || !/^[a-z]+$/.test(look)) return null
  const bytes = await readFile(join(process.cwd(), "public/looks", `${look}.png`)).catch(() => null)
  return bytes ? `data:image/png;base64,${bytes.toString("base64")}` : null
}

const auras = [
  `radial-gradient(70% 45% at 85% 8%, ${C.aura[0]}66, transparent 70%), radial-gradient(60% 40% at 0% 100%, ${C.aura[1]}55, transparent 70%)`,
  `radial-gradient(80% 45% at 10% 10%, ${C.aura[1]}66, transparent 70%), radial-gradient(60% 40% at 100% 90%, ${C.aura[0]}44, transparent 70%)`,
  `radial-gradient(70% 50% at 50% 0%, ${C.aura[2]}55, transparent 70%), radial-gradient(60% 40% at 0% 100%, ${C.aura[0]}44, transparent 70%)`,
  `radial-gradient(80% 50% at 100% 20%, ${C.aura[0]}55, transparent 70%), radial-gradient(70% 40% at 0% 80%, ${C.aura[2]}44, transparent 70%)`,
  `radial-gradient(80% 50% at 50% 100%, ${C.aura[1]}66, transparent 70%), radial-gradient(60% 40% at 100% 0%, ${C.aura[0]}55, transparent 70%)`,
]

function Frame({ w, n, children }: { w: Wrapped; n: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: "88px 80px 80px",
        background: `${auras[(n - 1) % auras.length]}, ${C.wall}`,
        color: C.ink,
        fontFamily: "Funnel Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, color: C.muted }}>
          {`Najimi Wrapped · ${w.year}`}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {Array.from({ length: SLIDES }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: one dot per slide, by position
              key={i}
              style={{
                display: "flex",
                width: i + 1 === n ? 44 : 14,
                height: 14,
                borderRadius: 999,
                background: i + 1 === n ? C.ink : "#ffffff40",
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>{children}</div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: "2px solid #ffffff22",
          paddingTop: 36,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600 }}>
            {w.username ? `@${w.username}` : w.name}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.muted }}>
            The group-chat agent that plans for everyone's taste
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14 }}>
          <div style={{ display: "flex", fontFamily: "Funnel Display", fontSize: 64 }}>najimi</div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: C.muted }}
          >
            taste by <OgQloo height={22} color={C.ink} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Big faded type behind a slide, sized so it stays on one line. */
function Ghost({ text, top }: { text: string; top: number }) {
  const size = Math.min(220, Math.floor(1700 / Math.max(text.length, 4)))
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top,
        left: 60,
        right: 60,
        justifyContent: "center",
        fontFamily: "Funnel Display",
        fontSize: size,
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: "#ffffff14",
        letterSpacing: -6,
      }}
    >
      {text}
    </div>
  )
}

function Cover({ w, face }: { w: Wrapped; face: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        position: "relative",
      }}
    >
      <Ghost text={String(w.year)} top={120} />
      <div
        style={{
          display: "flex",
          width: 420,
          height: 420,
          borderRadius: 999,
          padding: 14,
          background: `linear-gradient(135deg, ${C.aura[0]}, ${C.aura[1]}, ${C.aura[2]})`,
        }}
      >
        {face ? (
          // biome-ignore lint/performance/noImgElement: next/og renders plain img
          <img
            src={face}
            width={392}
            height={392}
            alt=""
            style={{ borderRadius: 999, background: C.card }}
          />
        ) : (
          <div
            style={{
              display: "flex",
              width: 392,
              height: 392,
              borderRadius: 999,
              background: C.card,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 160,
              fontFamily: "Funnel Display",
            }}
          >
            {w.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{ display: "flex", fontFamily: "Funnel Display", fontSize: 120, lineHeight: 1 }}
        >
          {w.name}
        </div>
        <div style={{ display: "flex", fontSize: 54, color: C.muted }}>{`a year in taste`}</div>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16,
          maxWidth: 860,
        }}
      >
        {w.words.slice(0, 4).map((word) => (
          <div
            key={word}
            style={{
              display: "flex",
              padding: "16px 30px",
              borderRadius: 999,
              background: "#ffffff18",
              fontSize: 40,
              fontWeight: 600,
            }}
          >
            {word}
          </div>
        ))}
      </div>
    </div>
  )
}

function Loves({ w }: { w: Wrapped }) {
  const art = w.loves.filter((l) => l.image)
  const top = art.slice(0, 3)
  const more = art.slice(3, 6)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        justifyContent: "center",
        gap: 70,
        position: "relative",
      }}
    >
      <Ghost text="you love" top={60} />
      <div style={{ display: "flex", justifyContent: "center", gap: 34 }}>
        {top.map((l, i) => (
          <div
            key={l.name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              width: 280,
            }}
          >
            <div style={{ display: "flex", position: "relative" }}>
              {/* biome-ignore lint/performance/noImgElement: next/og renders plain img */}
              <img
                src={sized(l.image, 480) ?? ""}
                width={280}
                height={390}
                alt=""
                style={{ borderRadius: 999, objectFit: "cover" }}
              />
              <div
                style={{
                  display: "flex",
                  position: "absolute",
                  right: 8,
                  bottom: 8,
                  width: 76,
                  height: 76,
                  borderRadius: 999,
                  background: C.ink,
                  color: C.wall,
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 42,
                  fontWeight: 600,
                }}
              >
                {i + 1}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 40,
                fontWeight: 600,
                textAlign: "center",
                justifyContent: "center",
                lineHeight: 1.1,
              }}
            >
              {l.name}
            </div>
          </div>
        ))}
      </div>
      {more.length ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 34 }}>
          {more.map((l) => (
            <div
              key={l.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
                width: 280,
              }}
            >
              {/* biome-ignore lint/performance/noImgElement: next/og renders plain img */}
              <img
                src={sized(l.image, 480) ?? ""}
                width={280}
                height={280}
                alt=""
                style={{ borderRadius: 36, objectFit: "cover" }}
              />
              <div
                style={{
                  display: "flex",
                  fontSize: 32,
                  color: C.muted,
                  textAlign: "center",
                  justifyContent: "center",
                }}
              >
                {l.name}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Words({ w }: { w: Wrapped }) {
  const sizes = [150, 120, 104, 92, 82, 74, 68, 62]
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        justifyContent: "center",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", fontSize: 48, color: C.muted, marginBottom: 30 }}>
        Your taste, in words
      </div>
      {w.words.map((word, i) => (
        <div
          key={word}
          style={{
            display: "flex",
            fontFamily: "Funnel Display",
            fontSize: sizes[i] ?? 60,
            lineHeight: 1,
            letterSpacing: -2,
            color: i % 3 === 0 ? C.ink : i % 3 === 1 ? C.signal : `${C.ink}aa`,
          }}
        >
          {word}
        </div>
      ))}
    </div>
  )
}

function People({ w, twinFace }: { w: Wrapped; twinFace: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        justifyContent: "center",
        gap: 60,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 48, color: C.muted }}>Your people live in</div>
        <div
          style={{ display: "flex", fontFamily: "Funnel Display", fontSize: 150, lineHeight: 1 }}
        >
          {w.city?.split(",")[0] ?? "the world"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
          {w.areas.map((a) => (
            <div
              key={a}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 22,
                fontSize: 52,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: C.signal,
                }}
              />
              {a}
            </div>
          ))}
        </div>
      </div>
      {w.twin ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 36,
            padding: 36,
            borderRadius: 48,
            background: "#ffffff12",
          }}
        >
          {twinFace ? (
            // biome-ignore lint/performance/noImgElement: next/og renders plain img
            <img
              src={twinFace}
              width={170}
              height={170}
              alt=""
              style={{ borderRadius: 999, background: C.card }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: 170,
                height: 170,
                borderRadius: 999,
                background: C.aura[1],
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                fontFamily: "Funnel Display",
              }}
            >
              {w.twin.name.slice(0, 1)}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 34, color: C.muted }}>Your taste twin</div>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 600 }}>{w.twin.name}</div>
            <div
              style={{ display: "flex", fontSize: 34, color: C.signal }}
            >{`${w.twin.shared} ${w.twin.shared === 1 ? "love" : "loves"} in common`}</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Passport({ w }: { w: Wrapped }) {
  const tiles = [
    { n: w.counts.loves, label: "new loves" },
    { n: w.counts.nights, label: "nights out" },
    { n: w.counts.trips, label: "trips & stays" },
    { n: w.counts.games, label: "games played" },
  ]
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        justifyContent: "center",
        gap: 50,
        position: "relative",
      }}
    >
      <Ghost text="passport" top={40} />
      <div
        style={{ display: "flex", fontSize: 48, color: C.muted }}
      >{`${w.counts.stamps} stamps in ${w.year}`}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              display: "flex",
              flexDirection: "column",
              width: 446,
              padding: "44px 40px",
              borderRadius: 48,
              background: "#ffffff12",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: "Funnel Display",
                fontSize: 160,
                lineHeight: 1,
              }}
            >
              {String(tile.n)}
            </div>
            <div style={{ display: "flex", fontSize: 40, color: C.muted }}>{tile.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 600 }}>
        Find your people → najimi
      </div>
    </div>
  )
}

/** The landscape preview for a shared link. */
function Card({ w, face }: { w: Wrapped; face: string | null }) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        gap: 56,
        padding: "0 80px",
        background: `${auras[0]}, ${C.wall}`,
        color: C.ink,
        fontFamily: "Funnel Sans",
      }}
    >
      {face ? (
        // biome-ignore lint/performance/noImgElement: next/og renders plain img
        <img
          src={face}
          width={300}
          height={300}
          alt=""
          style={{ borderRadius: 999, background: C.card, border: `10px solid ${C.aura[0]}` }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{ display: "flex", fontSize: 32, color: C.muted }}
        >{`Najimi Wrapped · ${w.year}`}</div>
        <div style={{ display: "flex", fontFamily: "Funnel Display", fontSize: 96, lineHeight: 1 }}>
          {w.name}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 680 }}>
          {w.words.slice(0, 3).map((word) => (
            <div
              key={word}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                background: "#ffffff18",
                fontSize: 28,
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ token: string; slide: string }> },
) {
  const { token, slide } = await ctx.params
  const share = await liveShare(token)
  if (share?.kind !== "wrapped") return new Response("Not found", { status: 404 })
  const year = new Date(share.createdAt).getUTCFullYear()
  const w = await wrappedOf(share.refId, year)
  if (!w) return new Response("Not found", { status: 404 })
  const fonts = await funnelFonts()
  const face = await lookOf(w.look)
  if (slide === "og")
    return new ImageResponse(<Card w={w} face={face} />, { ...OG_SIZE, fonts, headers: OG_HEADERS })
  const n = Number(slide)
  if (!Number.isInteger(n) || n < 1 || n > SLIDES) return new Response("Not found", { status: 404 })
  const twinFace = n === 4 ? await lookOf(w.twin?.look ?? null) : null
  const body =
    n === 1 ? (
      <Cover w={w} face={face} />
    ) : n === 2 ? (
      <Loves w={w} />
    ) : n === 3 ? (
      <Words w={w} />
    ) : n === 4 ? (
      <People w={w} twinFace={twinFace} />
    ) : (
      <Passport w={w} />
    )
  return new ImageResponse(
    <Frame w={w} n={n}>
      {body}
    </Frame>,
    { ...STORY, fonts, headers: OG_HEADERS },
  )
}
