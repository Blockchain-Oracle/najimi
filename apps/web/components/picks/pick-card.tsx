"use client"

import type { StoredPick } from "@najimi/db/schema"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  EyeOff,
  Headphones,
  MapPin,
  MoreHorizontal,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Artwork, shapeOf } from "@/components/artwork"
import { usePublicShare } from "@/components/chat/public-share"
import { BecauseChip } from "./because-chip"

export type PickActions = {
  saved: boolean
  onToggleSave: () => void
  onMore: () => void
  onNotForMe: () => void
}

const linkClass =
  "inline-flex h-7 items-center gap-1.5 rounded-tile px-2 text-xs font-medium text-text-2 transition-colors hover:bg-white/4 hover:text-foreground"

/**
 * One pick from Qloo (rule 1): the artwork first, then what it is, how well it fits (in mono),
 * the love behind it, one way to open it (listen, map, or the site) and the rest of the same
 * actions on every domain (rule 3) in a menu, so the artwork carries the card.
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
  const [listening, setListening] = useState(false)
  const links = pick.links ?? {}
  const match = pick.affinity != null ? Math.round(pick.affinity * 100) : null
  return (
    <article
      style={style}
      className={cn("flex w-32 shrink-0 snap-start flex-col gap-2 sm:w-36", className)}
    >
      <div className="relative">
        <Artwork
          src={pick.image}
          name={pick.name}
          shape={shapeOf(pick.type) === "poster" ? "poster" : "square"}
        />
        {actions?.saved ? (
          <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-on-ink">
            <BookmarkCheck className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="line-clamp-2 text-[13px] leading-snug font-medium">{pick.name}</h3>
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
      <BecauseChip because={pick.because} callId={pick.callId} publicView={publicView} />
      <div className="-ms-2 mt-auto flex items-center">
        {links.embed ? (
          <button type="button" onClick={() => setListening(true)} className={linkClass}>
            <Headphones className="size-3.5" strokeWidth={1.75} /> {t("listen")}
          </button>
        ) : links.map ? (
          <a href={links.map} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <MapPin className="size-3.5" strokeWidth={1.75} /> {t("map")}
          </a>
        ) : links.open ? (
          <a href={links.open} target="_blank" rel="noopener noreferrer" className={linkClass}>
            <ExternalLink className="size-3.5" strokeWidth={1.75} /> {t("open")}
          </a>
        ) : null}
        {actions || links.menu || links.phone ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("actions")}
              title={t("actions")}
              className="ms-auto grid size-7 place-items-center rounded-tile text-text-3 transition-colors hover:bg-white/4 hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {actions ? (
                <>
                  <DropdownMenuItem onClick={actions.onToggleSave}>
                    {actions.saved ? <BookmarkCheck /> : <Bookmark />}
                    {actions.saved ? t("unsave") : t("save")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={actions.onMore}>
                    <Sparkles /> {t("more")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={actions.onNotForMe}>
                    <EyeOff /> {t("notForMe")}
                  </DropdownMenuItem>
                </>
              ) : null}
              {actions && (links.menu || links.phone) ? <DropdownMenuSeparator /> : null}
              {links.menu ? (
                <DropdownMenuItem onClick={() => window.open(links.menu, "_blank", "noopener")}>
                  <UtensilsCrossed /> {t("menu")}
                </DropdownMenuItem>
              ) : null}
              {links.phone ? (
                <DropdownMenuItem onClick={() => window.location.assign(links.phone ?? "")}>
                  <Phone /> {t("call")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {links.embed ? (
        <Dialog open={listening} onOpenChange={setListening}>
          <DialogContent className="max-w-md rounded-card border-0 bg-popover p-3 text-popover-foreground shadow-float">
            <DialogTitle className="px-1 text-sm">{pick.name}</DialogTitle>
            {listening ? (
              <iframe
                title={pick.name}
                src={`${links.embed}?utm_source=generator&theme=0`}
                height={352}
                className="w-full rounded-tile"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
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
