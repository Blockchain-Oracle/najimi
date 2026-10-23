"use client"

import type { StorySong, StoryThing } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { Loader2, Music2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { RefObject } from "react"

/*
 * What a story shows, full-bleed in a 9:16 frame: a photo or a video edge to edge, a song as its
 * cover on its own colour, a pick or a plan as its artwork with its name, a Wrapped slide whole;
 * the caption sits low, over a shade. The same renderer draws the composer's preview.
 */

export type StoryShape = {
  kind: "photo" | "video" | "song" | "pick" | "plan" | "wrapped"
  status?: "processing" | "ready" | "failed"
  caption: string | null
  media: { src: string | null; poster: string | null; video: boolean }
  song: StorySong | null
  thing: StoryThing | null
  plan: { token: string; title: string; city: string | null; image: string | null } | null
  wrapped: { token: string; slide: number } | null
}

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

/** Artwork, blown up and blurred into the frame's own colour. */
function Wash({ src }: { src: string | null }) {
  return (
    <>
      {src ? (
        // biome-ignore lint/performance/noImgElement: remote artwork, a blurred wash
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-3xl saturate-150"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_60%_at_30%_25%,var(--color-aura-1),transparent_70%),radial-gradient(70%_60%_at_75%_70%,var(--color-aura-2),transparent_70%)] opacity-60"
        />
      )}
      <span aria-hidden className="absolute inset-0 bg-black/35" />
    </>
  )
}

export function StoryContent({
  story,
  videoRef,
  onVideoReady,
  onVideoEnd,
}: {
  story: StoryShape
  videoRef?: RefObject<HTMLVideoElement | null>
  onVideoReady?: (seconds: number) => void
  onVideoEnd?: () => void
}) {
  const t = useTranslations("Stories")
  const s = story
  let body: React.ReactNode = null

  if (s.kind === "video" && s.status !== "ready") {
    body = (
      <div className="absolute inset-0 grid place-items-center bg-black">
        {s.media.poster ? (
          // biome-ignore lint/performance/noImgElement: the video's own still
          <img
            src={s.media.poster}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-50"
          />
        ) : null}
        <span className="relative flex items-center gap-2 text-[15px] text-white/85">
          {s.status === "failed" ? (
            t("videoFailed")
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" /> {t("videoProcessing")}
            </>
          )}
        </span>
      </div>
    )
  } else if ((s.kind === "photo" || s.kind === "video") && s.media.src) {
    body = s.media.video ? (
      // biome-ignore lint/a11y/useMediaCaption: people's own clips come without captions
      <video
        ref={videoRef}
        src={s.media.src}
        poster={s.media.poster ?? undefined}
        autoPlay
        playsInline
        onLoadedMetadata={(e) => onVideoReady?.(e.currentTarget.duration)}
        onEnded={onVideoEnd}
        className="absolute inset-0 size-full bg-black object-cover"
      />
    ) : (
      // biome-ignore lint/performance/noImgElement: their own photo, session-checked
      <img src={s.media.src} alt="" className="absolute inset-0 size-full bg-black object-cover" />
    )
  } else if (s.kind === "song" && s.song) {
    const art = s.song.artwork
    body = (
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <Wash src={art} />
        <div className="relative flex w-[72%] flex-col items-center gap-5 text-center">
          {art ? (
            // biome-ignore lint/performance/noImgElement: Apple artwork
            <img
              src={art}
              alt=""
              className="aspect-square w-full rounded-[22px] object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]"
            />
          ) : null}
          <span className="flex flex-col gap-1">
            <span className="font-title text-[26px] leading-tight text-balance text-white">
              {s.song.title}
            </span>
            <span className="text-[15px] text-white/75">{s.song.artist}</span>
          </span>
        </div>
      </div>
    )
  } else if ((s.kind === "pick" && s.thing) || (s.kind === "plan" && s.plan)) {
    const image = sized(s.thing?.image ?? s.plan?.image ?? null, 800)
    const title = s.thing?.name ?? s.plan?.title ?? ""
    const sub = s.kind === "plan" ? (s.plan?.city ?? t("aPlan")) : null
    body = (
      <div className="absolute inset-0 grid place-items-center overflow-hidden">
        <Wash src={image} />
        <div className="relative flex w-[76%] flex-col items-center gap-5 text-center">
          {image ? (
            // biome-ignore lint/performance/noImgElement: remote artwork
            <img
              src={image}
              alt=""
              className={cn(
                "w-full rounded-[22px] object-cover shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]",
                s.thing?.type === "urn:entity:movie" || s.thing?.type === "urn:entity:tv_show"
                  ? "aspect-[2/3] w-[80%]"
                  : "aspect-[4/5]",
              )}
            />
          ) : null}
          <span className="flex flex-col gap-1">
            {sub ? (
              <span className="text-[12px] font-semibold tracking-[0.12em] text-white/70 uppercase">
                {sub}
              </span>
            ) : null}
            <span className="font-title text-[26px] leading-tight text-balance text-white">
              {title}
            </span>
          </span>
        </div>
      </div>
    )
  } else if (s.kind === "wrapped" && s.wrapped) {
    body = (
      // biome-ignore lint/performance/noImgElement: our own generated story slide
      <img
        src={`/api/og/wrapped/${s.wrapped.token}/${s.wrapped.slide}`}
        alt=""
        className="absolute inset-0 size-full bg-black object-cover"
      />
    )
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {body}
      {/* A song on a photo plays while it shows; its credit sits like a sticker. */}
      {s.kind === "photo" && s.song ? (
        <span className="absolute top-24 left-4 flex max-w-[75%] items-center gap-2.5 rounded-tile bg-black/45 p-1.5 pe-3 text-white ring-1 ring-white/15 backdrop-blur-md">
          {s.song.artwork ? (
            // biome-ignore lint/performance/noImgElement: Apple artwork
            <img src={s.song.artwork} alt="" className="size-9 rounded-[8px] object-cover" />
          ) : (
            <Music2 className="size-5" />
          )}
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">{s.song.title}</span>
            <span className="truncate text-[12px] text-white/70">{s.song.artist}</span>
          </span>
        </span>
      ) : null}
      {s.caption ? (
        <>
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent"
          />
          <p className="absolute inset-x-6 bottom-44 text-center text-[19px] leading-snug font-semibold text-balance text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
            {s.caption}
          </p>
        </>
      ) : null}
    </div>
  )
}
