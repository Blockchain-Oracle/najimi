"use client"

import { cn } from "@najimi/ui/lib/utils"
import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { NowPlaying, PlayPause } from "./now-playing"
import { usePlayer, usePlayerClock } from "./player"

/*
 * What's playing, on every screen but the feed (where the card is the player): a glass bar floating
 * just above the tab bar on phones, and beside the rail on desktop. Tap it for the full player.
 */

function Progress() {
  const player = usePlayer()
  const clock = usePlayerClock()
  const share = player.duration ? Math.min(1, clock / player.duration) : 0
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-current/15"
    >
      <span
        className="block h-full origin-left bg-current"
        style={{ transform: `scaleX(${share})` }}
      />
    </span>
  )
}

export function MiniPlayer() {
  const t = useTranslations("Player")
  const player = usePlayer()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const track = player.track
  // Paths may carry a locale first ("/fr/feed"), so look at the first two segments.
  const section = (pathname ?? "").split("/").slice(1, 3)
  const onFeed = section.includes("feed")
  // In a chat the composer owns the bottom of the screen, so the bar moves under the header.
  const onChat = section.includes("c")
  const shown = Boolean(track) && !onFeed

  // Pages leave room for the bar while it's up.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-player", shown)
    return () => document.documentElement.removeAttribute("data-player")
  }, [shown])

  return (
    <>
      <AnimatePresence>
        {shown && track ? (
          <motion.div
            key="mini"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "glass fixed z-40 flex items-center gap-3 rounded-card py-2 ps-2 pe-1.5 shadow-float",
              onChat
                ? "inset-x-3 top-[calc(3.9rem+env(safe-area-inset-top))]"
                : "inset-x-3 bottom-[calc(4.9rem+env(safe-area-inset-bottom))]",
              "md:inset-x-auto md:top-auto md:start-[6.5rem] md:bottom-5 md:w-[22rem]",
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("open")}
              className="flex min-w-0 flex-1 items-center gap-3 text-start"
            >
              {track.artwork ? (
                // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
                <img
                  src={track.artwork}
                  alt=""
                  className="size-10 shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                <span className="size-10 shrink-0 rounded-[10px] bg-secondary" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[14px] font-semibold leading-tight">
                  {track.title}
                </span>
                <span className="truncate text-[12px] text-text-3">{track.by}</span>
              </span>
            </button>
            <PlayPause size="sm" />
            <button
              type="button"
              onClick={() => player.stop()}
              aria-label={t("close")}
              className="grid size-9 shrink-0 place-items-center rounded-full text-text-3 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <Progress />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <NowPlaying open={open} onOpenChange={setOpen} />
    </>
  )
}
