"use client"

import type { Scene } from "@najimi/qloo"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { useQuery } from "@tanstack/react-query"
import { MapPin, MessageCircle, Moon, Store } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAgent } from "@/components/agent/agent-context"
import { ProfileLink } from "@/components/people/profile-link"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"

/*
 * A spot's scene (W12): what the people around it love (its artists, places, brands and words,
 * from a location-only signal with no person in it), who here lives near, and one tap to have
 * Najimi plan a night there. A frosted sheet over the map, after CARROT Weather's area sheet
 * (Refero de65fc1d).
 */

export type SceneSpot = {
  lat: number
  lon: number
  name: string | null
  city: string | null
  /** How strongly the taste on the map lives here, 0–1. */
  fit: number
}

type Near = {
  userId: string
  name: string
  look: string | null
  username: string | null
  km: number
}

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[12px] font-bold tracking-[0.08em] text-text-3 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {[64, 88, 56, 72, 96].map((w) => (
          <span
            key={w}
            className="h-7 animate-pulse rounded-pill bg-white/10"
            style={{ width: w }}
          />
        ))}
      </div>
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="size-16 shrink-0 animate-pulse rounded-full bg-white/10" />
        ))}
      </div>
      <div className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-36 w-32 shrink-0 animate-pulse rounded-card bg-white/10" />
        ))}
      </div>
    </div>
  )
}

export function SceneSheet({ spot, onClose }: { spot: SceneSpot | null; onClose: () => void }) {
  const t = useTranslations("Earth")
  const agent = useAgent()
  const scene = useQuery({
    queryKey: ["earth-scene", spot?.lat.toFixed(3), spot?.lon.toFixed(3)],
    queryFn: () =>
      api<{ scene: Scene; people: Near[] }>(`/api/earth/scene?lat=${spot?.lat}&lon=${spot?.lon}`),
    enabled: Boolean(spot),
    staleTime: 10 * 60_000,
  })
  const name = spot?.name ?? t("aroundHere")
  const where = [spot?.name, spot?.city].filter(Boolean).join(", ") || t("thisSpot")
  const s = scene.data?.scene

  return (
    <Sheet open={Boolean(spot)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="dark max-h-[78svh] overflow-y-auto rounded-t-sheet border-0 bg-[#0d0c12]/92 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground backdrop-blur-xl"
      >
        <div className="flex flex-col gap-1 pt-5">
          <span className="text-[11px] font-bold tracking-[0.1em] text-signal uppercase">
            {t("scene")}
          </span>
          <SheetTitle className="font-title text-[1.9rem] leading-none font-normal">
            {name}
          </SheetTitle>
          <span className="flex items-center gap-2 text-[13px] text-text-3">
            <MapPin className="size-3.5" />
            {spot?.city ?? ""}
            {spot ? (
              <span className="rounded-pill bg-signal-soft px-2 py-0.5 font-semibold text-signal">
                {t("fit", { percent: Math.round(spot.fit * 100) })}
              </span>
            ) : null}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              agent.ask(t("askNight", { where }))
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-pill bg-foreground text-[15px] font-semibold text-background"
          >
            <Moon className="size-4" />
            {t("planNight")}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              agent.ask(t("askAbout", { where }))
            }}
            className="glass flex h-12 items-center justify-center gap-2 rounded-pill text-[15px] font-semibold"
          >
            <MessageCircle className="size-4" />
            {t("askNajimi")}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              agent.ask(t("askBusiness", { where }))
            }}
            className="glass col-span-2 flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold"
          >
            <Store className="size-4" />
            {t("businessHere")}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {scene.isPending ? (
            <Skeleton />
          ) : (
            <>
              {s?.words.length ? (
                <Row title={t("feelsLike")}>
                  <div className="flex flex-wrap gap-2">
                    {s.words.map((w) => (
                      <span
                        key={w.name}
                        className="rounded-pill bg-white/8 px-3 py-1 text-[13px] font-semibold"
                      >
                        {w.name}
                      </span>
                    ))}
                  </div>
                </Row>
              ) : null}
              {s?.artists.length ? (
                <Row title={t("soundsLike")}>
                  <div className="-mx-5 flex gap-4 overflow-x-auto px-5 [scrollbar-width:none]">
                    {s.artists.map((a) => (
                      <span
                        key={a.qlooId}
                        className="flex w-16 shrink-0 flex-col items-center gap-1.5"
                      >
                        {/* biome-ignore lint/performance/noImgElement: remote artwork */}
                        <img
                          src={sized(a.image, 160) ?? ""}
                          alt=""
                          className="size-16 rounded-full bg-white/10 object-cover ring-1 ring-white/15"
                        />
                        <span className="w-full truncate text-center text-[12px] font-semibold">
                          {a.name}
                        </span>
                      </span>
                    ))}
                  </div>
                </Row>
              ) : null}
              {s?.places.length ? (
                <Row title={t("goTo")}>
                  <div className="-mx-5 flex gap-3 overflow-x-auto px-5 [scrollbar-width:none]">
                    {s.places.map((p) => (
                      <span key={p.qlooId} className="flex w-36 shrink-0 flex-col gap-1.5">
                        {/* biome-ignore lint/performance/noImgElement: remote artwork */}
                        <img
                          src={sized(p.image, 320) ?? ""}
                          alt=""
                          className="aspect-[4/3] w-full rounded-tile bg-white/10 object-cover"
                        />
                        <span className="truncate text-[14px] font-semibold">{p.name}</span>
                        {p.caption ? (
                          <span className="-mt-1 truncate text-[12px] text-text-3">
                            {p.caption}
                          </span>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </Row>
              ) : null}
              {s?.brands.length ? (
                <Row title={t("wears")}>
                  <div className="flex flex-wrap gap-2">
                    {s.brands.map((b) => (
                      <span
                        key={b.qlooId}
                        className="flex items-center gap-2 rounded-pill bg-white/8 py-1 ps-1 pe-3 text-[13px] font-semibold"
                      >
                        {/* biome-ignore lint/performance/noImgElement: remote logo */}
                        <img
                          src={sized(b.image, 80) ?? ""}
                          alt=""
                          className="size-6 rounded-full bg-white object-contain"
                        />
                        {b.name}
                      </span>
                    ))}
                  </div>
                </Row>
              ) : null}
              {scene.data?.people.length ? (
                <Row title={t("locals")}>
                  <div className="flex flex-wrap gap-3">
                    {scene.data.people.map((p) => (
                      <ProfileLink
                        key={p.userId}
                        username={p.username}
                        className="flex w-14 flex-col items-center gap-1"
                      >
                        <Face look={p.look} name={p.name} size="md" />
                        <span className="w-full truncate text-center text-[12px] font-semibold">
                          {p.name}
                        </span>
                      </ProfileLink>
                    ))}
                  </div>
                </Row>
              ) : null}
              {s && !s.words.length && !s.artists.length && !s.places.length ? (
                <p className="text-[14px] text-text-3">{t("quiet")}</p>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
