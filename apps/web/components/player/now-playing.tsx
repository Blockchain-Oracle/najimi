"use client"

import { Dialog } from "@base-ui/react/dialog"
import { Slider as SliderPrimitive } from "@base-ui/react/slider"
import { cn } from "@najimi/ui/lib/utils"
import { ChevronDown, Loader2, Pause, Play, SkipBack, SkipForward } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useRef } from "react"
import { AppleMusicBadge, PodcastCredit, PreviewCredit } from "./credit"
import { formatTime, usePlayer, usePlayerClock } from "./player"

/*
 * The full player: the artwork floods the screen as a blurred wash, the cover sits large, then
 * title, a scrubber with times, and the controls. The credit sits under the controls, where the eye
 * lands next.
 */

/** A seek bar on the shared clock; dragging pauses and resumes like a real player. */
export function Scrubber({ className, thin = false }: { className?: string; thin?: boolean }) {
  const t = useTranslations("Player")
  const player = usePlayer()
  const clock = usePlayerClock()
  const resume = useRef(false)
  const max = player.duration ?? 0
  return (
    <SliderPrimitive.Root
      aria-label={t("seek")}
      value={Math.min(clock, max || 0)}
      min={0}
      max={max || 1}
      step={0.25}
      disabled={!max}
      onValueChange={(v) => player.seek(Array.isArray(v) ? (v[0] ?? 0) : v)}
      onPointerDown={() => {
        resume.current = player.playing
        player.pause()
      }}
      onValueCommitted={() => {
        if (resume.current) void player.play()
      }}
      className={cn("group/scrub w-full", className)}
    >
      <SliderPrimitive.Control className="relative flex h-5 w-full touch-none items-center select-none">
        <SliderPrimitive.Track
          className={cn(
            "relative w-full grow overflow-hidden rounded-full bg-white/25",
            thin ? "h-[3px]" : "h-1",
          )}
        >
          <SliderPrimitive.Indicator className="h-full bg-white" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-3.5 rounded-full bg-white shadow-lift opacity-0 transition-opacity group-hover/scrub:opacity-100 focus-visible:opacity-100 focus-visible:outline-none data-dragging:opacity-100" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export function PlayPause({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const t = useTranslations("Player")
  const player = usePlayer()
  const busy = player.buffering && player.playing
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        player.toggle()
      }}
      aria-label={player.playing ? t("pause") : t("play")}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-transform active:scale-95",
        size === "lg" ? "size-16 bg-white text-black" : "size-10 text-current",
        className,
      )}
    >
      {busy ? (
        <Loader2 className={cn("animate-spin", size === "lg" ? "size-7" : "size-5")} />
      ) : player.playing ? (
        <Pause className={cn("fill-current", size === "lg" ? "size-7" : "size-5")} />
      ) : (
        <Play className={cn("translate-x-px fill-current", size === "lg" ? "size-7" : "size-5")} />
      )}
    </button>
  )
}

export function NowPlaying({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Player")
  const player = usePlayer()
  const clock = usePlayerClock()
  const track = player.track
  return (
    <Dialog.Root open={open && Boolean(track)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-black text-white transition duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full">
          {track?.artwork ? (
            // biome-ignore lint/performance/noImgElement: a blurred wash of remote artwork
            <img
              src={track.artwork}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-125 object-cover opacity-70 blur-3xl saturate-150"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
          <div className="relative mx-auto flex h-full w-full max-w-md flex-col px-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex h-12 items-center justify-between">
              <Dialog.Close
                aria-label={t("collapse")}
                className="grid size-10 place-items-center rounded-full hover:bg-white/10"
              >
                <ChevronDown className="size-6" />
              </Dialog.Close>
              <Dialog.Title className="text-[13px] font-semibold text-white/80">
                {t("nowPlaying")}
              </Dialog.Title>
              {track?.pickId ? (
                <Link
                  href="/feed"
                  onClick={() => onOpenChange(false)}
                  className="rounded-pill px-3 py-1.5 text-[12px] font-semibold text-white/80 hover:bg-white/10"
                >
                  {t("backToCard")}
                </Link>
              ) : (
                <span className="size-10" />
              )}
            </div>
            <div className="flex flex-1 items-center justify-center py-6">
              {track?.artwork ? (
                // biome-ignore lint/performance/noImgElement: remote artwork at its own size
                <img
                  src={track.artwork}
                  alt=""
                  className={cn(
                    "aspect-square w-full max-w-[22rem] rounded-card object-cover shadow-float transition-transform duration-500",
                    player.playing ? "scale-100" : "scale-[0.92]",
                  )}
                />
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-title truncate text-[26px] leading-tight">{track?.title}</p>
              <p className="truncate text-[15px] text-white/70">{track?.by}</p>
            </div>
            <div className="mt-5 flex flex-col gap-1">
              <Scrubber />
              <div className="flex justify-between text-[11px] text-white/60 tabular-nums">
                <span>{formatTime(clock)}</span>
                <span>-{formatTime((player.duration ?? 0) - clock)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => player.previous()}
                aria-label={t("previous")}
                className="grid size-12 place-items-center rounded-full hover:bg-white/10"
              >
                <SkipBack className="size-7 fill-current" />
              </button>
              <PlayPause />
              <button
                type="button"
                onClick={() => player.next()}
                aria-label={t("next")}
                className="grid size-12 place-items-center rounded-full hover:bg-white/10"
              >
                <SkipForward className="size-7 fill-current" />
              </button>
            </div>
            {player.failed ? (
              <p className="mt-3 text-center text-[13px] text-white/70">{t("failed")}</p>
            ) : null}
            <div className="mt-6 flex flex-col items-center gap-2">
              {track?.source === "apple" && track.store ? (
                <>
                  <AppleMusicBadge href={track.store} />
                  <PreviewCredit />
                </>
              ) : track ? (
                <PodcastCredit href={track.store} />
              ) : null}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
