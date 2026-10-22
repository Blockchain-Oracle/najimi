"use client"

import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { siApplemusic, siApplepodcasts } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"

/*
 * The credit each source asks for. Apple's preview terms: the preview sits beside a link to the
 * song on Apple's store and says it is "courtesy of" Apple; nothing suggests it's the full track.
 * A podcast episode plays from the show's own feed, with the show on Apple Podcasts one tap away.
 */

/** "Listen on Apple Music": the store link every preview carries (after Airbuds, Refero c410e046). */
export function AppleMusicBadge({ href, className }: { href: string; className?: string }) {
  const t = useTranslations("Feed")
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-2 rounded-tile bg-black/55 px-2.5 py-1.5 text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-black/70",
        className,
      )}
    >
      <BrandIcon icon={siApplemusic} colored className="size-5" />
      <span className="flex flex-col leading-none">
        <span className="text-[9px] font-medium tracking-wide text-white/75">{t("listenOn")}</span>
        <span className="text-[13px] font-semibold tracking-tight">{t("appleMusic")}</span>
      </span>
    </a>
  )
}

export function PreviewCredit({ className }: { className?: string }) {
  const t = useTranslations("Feed")
  return <span className={cn("text-[11px] text-white/60", className)}>{t("previewCredit")}</span>
}

/** The show on Apple Podcasts, beside an episode that plays from the show's own feed. */
export function PodcastCredit({ href, className }: { href: string | null; className?: string }) {
  const t = useTranslations("Feed")
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] text-white/60", className)}>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-pill bg-black/55 px-2.5 py-1 text-[12px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-black/70"
        >
          <BrandIcon icon={siApplepodcasts} colored className="size-3.5" />
          {t("applePodcasts")}
        </a>
      ) : null}
      {t("episodeCredit")}
    </span>
  )
}
