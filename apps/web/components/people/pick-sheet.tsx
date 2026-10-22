"use client"

import type { StoredPick } from "@najimi/db/schema"
import { cn } from "@najimi/ui/lib/utils"
import { Bookmark, ExternalLink, EyeOff, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { DarkSheet } from "@/components/feed/dark-sheet"
import { ShareBars, type ShareLove } from "@/components/feed/share-bars"

/*
 * One pick, opened from a profile's grid: its artwork large, what it is, how much each love
 * pulled it in, and what to do with it (keep, more like it, open, not for me).
 */

const sized = (url: string | null, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : url

const POSTER = new Set(["urn:entity:movie", "urn:entity:tv_show", "urn:entity:book"])

export function PickSheet({
  readOnly = false,
  pick,
  loves,
  saved,
  onClose,
  onToggleSave,
  onMore,
  onNotForMe,
}: {
  /** Someone else's pick: look and open, nothing to change. */
  readOnly?: boolean
  pick: StoredPick | null
  loves: ShareLove[]
  saved: boolean
  onClose: () => void
  onToggleSave: () => void
  onMore: () => void
  onNotForMe: () => void
}) {
  const t = useTranslations("Feed")
  const tp = useTranslations("Pick")
  const open = pick?.links?.imdb ?? pick?.links?.spotify ?? pick?.links?.open ?? null
  const action =
    "flex flex-1 flex-col items-center gap-1.5 rounded-tile bg-white/[0.06] px-2 py-3 text-[12px] font-semibold transition-colors hover:bg-white/10"
  return (
    <DarkSheet
      open={Boolean(pick)}
      onOpenChange={(o) => (o ? null : onClose())}
      title={pick?.name ?? ""}
    >
      {pick ? (
        <div className="flex flex-col gap-5">
          <div className="flex gap-4">
            {pick.image ? (
              // biome-ignore lint/performance/noImgElement: remote artwork
              <img
                src={sized(pick.image, 600) ?? pick.image}
                alt=""
                className={cn(
                  "shrink-0 rounded-card object-cover shadow-float",
                  POSTER.has(pick.type) ? "aspect-[2/3] w-28" : "aspect-square w-32",
                )}
              />
            ) : null}
            <div className="flex min-w-0 flex-col justify-end gap-1.5">
              {pick.caption ? <p className="text-[14px] text-white/70">{pick.caption}</p> : null}
              {pick.area ? (
                <p className="text-[14px] text-white/70">{t("near", { area: pick.area })}</p>
              ) : null}
              {pick.affinity != null ? (
                <p className="font-title text-[28px] leading-none">
                  {Math.round(pick.affinity * 100)}%
                  <span className="ms-2 font-sans text-[13px] font-normal text-white/60">
                    {tp("matchWord")}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          <ShareBars shares={pick.shares ?? []} loves={loves} />
          <div className="flex gap-2">
            {readOnly ? null : (
              <button type="button" className={action} onClick={onToggleSave} aria-pressed={saved}>
                <Bookmark className={cn("size-5", saved && "fill-current")} />
                {saved ? tp("unsave") : tp("save")}
              </button>
            )}
            {readOnly ? null : (
              <button type="button" className={action} onClick={onMore}>
                <Sparkles className="size-5" />
                {tp("more")}
              </button>
            )}
            {open ? (
              <a className={action} href={open} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-5" />
                {tp("open")}
              </a>
            ) : null}
            {readOnly ? null : (
              <button type="button" className={cn(action, "text-[#FF6B7A]")} onClick={onNotForMe}>
                <EyeOff className="size-5" />
                {tp("notForMe")}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </DarkSheet>
  )
}
