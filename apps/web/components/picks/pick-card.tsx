"use client"

import type { StoredPick } from "@najimi/db/schema"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { Bookmark, BookmarkCheck, EyeOff, GitBranchPlus, MoreHorizontal, Play } from "lucide-react"
import { useTranslations } from "next-intl"
import { Artwork, shapeOf } from "@/components/artwork"
import { usePublicShare } from "@/components/chat/public-share"
import { useEntity } from "@/components/entity/entity-provider"
import { BecauseChip } from "./because-chip"

export type PickActions = {
  saved: boolean
  onToggleSave: () => void
  onMore: () => void
  onNotForMe: () => void
}

/** What a tap on the artwork plays or opens, shown on it. */
const PLAYS = new Set([
  "urn:entity:artist",
  "urn:entity:podcast",
  "urn:entity:movie",
  "urn:entity:tv_show",
])

/**
 * One pick from Qloo (rule 1): the artwork first, then what it is, how well it fits (in mono)
 * and the love behind it. A tap opens it in the entity sheet, wherever the card is (the trailer
 * plays, the songs play, a place opens its map and socials); the quick actions sit in a menu, so
 * the artwork carries the card.
 */
export function PickCard({
  pick,
  actions,
  className,
  style,
}: {
  pick: StoredPick
  actions?: PickActions
  className?: string
  style?: React.CSSProperties
}) {
  const t = useTranslations("Pick")
  const publicView = Boolean(usePublicShare())
  const entity = useEntity()
  const match = pick.affinity != null ? Math.round(pick.affinity * 100) : null
  const open = () => entity.open(pick, { surface: "room", readOnly: publicView })
  return (
    <article
      style={style}
      className={cn("flex w-32 shrink-0 snap-start flex-col gap-2 sm:w-36", className)}
    >
      <button
        type="button"
        onClick={open}
        aria-label={t("openThing", { name: pick.name })}
        className="group relative block rounded-tile text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Artwork
          src={pick.image}
          name={pick.name}
          shape={shapeOf(pick.type) === "poster" ? "poster" : "square"}
          className="transition-transform duration-300 group-hover:scale-[1.02] group-active:scale-[0.98]"
        />
        {PLAYS.has(pick.type) ? (
          <span className="absolute start-1.5 bottom-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur">
            <Play className="ms-0.5 size-3.5 fill-current" />
          </span>
        ) : null}
        {actions?.saved ? (
          <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-on-ink">
            <BookmarkCheck className="size-3.5" />
          </span>
        ) : null}
      </button>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={open}
          className="line-clamp-2 text-start text-[13px] leading-snug font-medium hover:underline"
        >
          {pick.name}
        </button>
        <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-text-3">
          {pick.caption ? <span className="truncate">{pick.caption}</span> : null}
          {match != null ? (
            <span
              className="ms-auto shrink-0 font-mono tnum"
              title={t("affinity", { value: match })}
            >
              {match}%
            </span>
          ) : null}
        </p>
      </div>
      <div className="mt-auto flex items-center gap-1">
        <div className="min-w-0">
          <BecauseChip because={pick.because} callId={pick.callId} publicView={publicView} />
        </div>
        {actions ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("actions")}
              title={t("actions")}
              className="ms-auto grid size-7 shrink-0 place-items-center rounded-tile text-text-3 transition-colors hover:bg-white/4 hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem onClick={actions.onToggleSave}>
                {actions.saved ? <BookmarkCheck /> : <Bookmark />}
                {actions.saved ? t("unsave") : t("save")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={actions.onMore}>
                <GitBranchPlus /> {t("more")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={actions.onNotForMe}>
                <EyeOff /> {t("notForMe")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </article>
  )
}

export function PickCardSkeleton() {
  return (
    <div className="flex w-32 shrink-0 flex-col gap-2 sm:w-36">
      <div className="aspect-square animate-pulse rounded-tile bg-raised" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-raised" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-raised" />
    </div>
  )
}
