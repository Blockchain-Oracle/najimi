"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@najimi/ui/components/popover"
import { useTranslations } from "next-intl"
import { QlooLogo, qlooTag } from "@/components/brands/qloo-logo"
import { CallDetails } from "@/components/qloo/call-details"
import { usePublicShare } from "../public-share"

/** The Qloo mark on every card: opens the exact call behind it. */
export function QlooChip({ callId }: { callId: string | null }) {
  const t = useTranslations("Evidence")
  const share = usePublicShare()
  if (!callId || share)
    return (
      <span className="inline-flex items-center rounded-pill bg-paper-foreground/8 px-2 py-1">
        <QlooLogo className="h-[9px]" />
      </span>
    )
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("open")}
        className="inline-flex items-center rounded-pill bg-sticker px-2 py-1 text-sticker-foreground transition-opacity hover:opacity-80"
      >
        <QlooLogo className="h-[9px]" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-card border-0 bg-sticker text-sticker-foreground shadow-sticker"
      >
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-lime uppercase">
          {t.rich("title", qlooTag("mx-0.5 h-[0.9em]"))}
        </p>
        <CallDetails callId={callId} />
      </PopoverContent>
    </Popover>
  )
}
