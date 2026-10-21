"use client"

import type { StoredPick } from "@najimi/db/schema"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { cn } from "@najimi/ui/lib/utils"
import {
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  EyeOff,
  Headphones,
  MapPin,
  Phone,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Artwork, shapeOf } from "@/components/artwork"
import { BecauseChip } from "./because-chip"

export type PickActions = {
  saved: boolean
  onToggleSave: () => void
  onMore: () => void
  onNotForMe: () => void
}

function IconAction({
  label,
  onClick,
  href,
  active,
  children,
}: {
  label: string
  onClick?: () => void
  href?: string
  active?: boolean
  children: React.ReactNode
}) {
  const className = cn(
    "grid size-8 place-items-center rounded-full transition-colors",
    active
      ? "bg-lime text-lime-foreground"
      : "text-paper-muted hover:bg-paper-foreground/8 hover:text-paper-foreground",
  )
  if (href)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        title={label}
        className={className}
      >
        {children}
      </a>
    )
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={className}
    >
      {children}
    </button>
  )
}

/**
 * One pick from Qloo (rule 1): artwork, what it is, how well it fits, the love behind it, and the
 * same four actions on every domain (rule 3). Artists play in place; places show map, menu and call.
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
  const [listening, setListening] = useState(false)
  const links = pick.links ?? {}
  return (
    <article
      style={style}
      className={cn(
        "flex w-44 shrink-0 snap-start flex-col gap-2 rounded-card bg-card p-2 text-card-foreground shadow-paper",
        className,
      )}
    >
      <Artwork
        src={pick.image}
        name={pick.name}
        shape={shapeOf(pick.type) === "poster" ? "poster" : "square"}
      />
      <div className="flex min-h-[2.75rem] flex-col px-1">
        <h3 className="line-clamp-2 text-sm leading-tight font-semibold">{pick.name}</h3>
        {pick.caption ? <p className="truncate text-xs text-paper-muted">{pick.caption}</p> : null}
      </div>
      {pick.affinity != null ? (
        <div
          className="flex items-center gap-2 px-1"
          title={t("affinity", { value: Math.round(pick.affinity * 100) })}
        >
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-paper-foreground/10">
            <span
              className="block h-full rounded-full bg-lime-ink"
              style={{ width: `${Math.round(pick.affinity * 100)}%` }}
            />
          </span>
          <span className="text-[11px] font-semibold text-paper-muted tnum">
            {Math.round(pick.affinity * 100)}%
          </span>
        </div>
      ) : null}
      <div className="px-0.5">
        <BecauseChip because={pick.because} callId={pick.callId} />
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        {actions ? (
          <>
            <IconAction
              label={actions.saved ? t("unsave") : t("save")}
              active={actions.saved}
              onClick={actions.onToggleSave}
            >
              {actions.saved ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <Bookmark className="size-4" />
              )}
            </IconAction>
            <IconAction label={t("more")} onClick={actions.onMore}>
              <Sparkles className="size-4" />
            </IconAction>
            <IconAction label={t("notForMe")} onClick={actions.onNotForMe}>
              <EyeOff className="size-4" />
            </IconAction>
          </>
        ) : null}
        {links.embed ? (
          <IconAction label={t("listen")} onClick={() => setListening(true)}>
            <Headphones className="size-4" />
          </IconAction>
        ) : links.map ? (
          <IconAction label={t("map")} href={links.map}>
            <MapPin className="size-4" />
          </IconAction>
        ) : links.open ? (
          <IconAction label={t("open")} href={links.open}>
            <ExternalLink className="size-4" />
          </IconAction>
        ) : null}
      </div>
      {links.menu || links.phone ? (
        <div className="flex gap-1 px-0.5 pb-0.5">
          {links.menu ? (
            <a
              href={links.menu}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-pill bg-paper-foreground/6 px-2 py-1 text-[11px] font-semibold"
            >
              <UtensilsCrossed className="size-3" /> {t("menu")}
            </a>
          ) : null}
          {links.phone ? (
            <a
              href={links.phone}
              className="inline-flex items-center gap-1 rounded-pill bg-paper-foreground/6 px-2 py-1 text-[11px] font-semibold"
            >
              <Phone className="size-3" /> {t("call")}
            </a>
          ) : null}
        </div>
      ) : null}
      {links.embed ? (
        <Dialog open={listening} onOpenChange={setListening}>
          <DialogContent className="max-w-md rounded-card border-0 bg-sticker p-3 text-sticker-foreground">
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
    <div className="flex w-44 shrink-0 flex-col gap-2 rounded-card bg-card/10 p-2">
      <div className="aspect-square animate-pulse rounded-tile bg-foreground/10" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-foreground/10" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-foreground/10" />
    </div>
  )
}
