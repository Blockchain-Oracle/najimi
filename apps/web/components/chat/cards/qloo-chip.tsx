"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@najimi/ui/components/popover"
import { useTranslations } from "next-intl"
import { CallDetails } from "@/components/qloo/call-details"
import { usePublicShare } from "../public-share"

/** The "from Qloo" mark on every card: opens the exact call behind it. */
export function QlooChip({ callId }: { callId: string | null }) {
  const t = useTranslations("Evidence")
  const share = usePublicShare()
  if (!callId || share)
    return (
      <span className="rounded-pill bg-paper-foreground/8 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
        Qloo
      </span>
    )
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 rounded-pill bg-sticker px-2 py-0.5 text-[10px] font-bold tracking-wide text-sticker-foreground uppercase">
        <span className="size-1.5 rounded-full bg-lime" /> Qloo
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-card border-0 bg-sticker text-sticker-foreground shadow-sticker"
      >
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-lime uppercase">
          {t("title")}
        </p>
        <CallDetails callId={callId} />
      </PopoverContent>
    </Popover>
  )
}
