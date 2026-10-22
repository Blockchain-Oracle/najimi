"use client"

import type { StoredPick } from "@najimi/db/schema"
import { Popover, PopoverContent, PopoverTrigger } from "@najimi/ui/components/popover"
import { Heart } from "lucide-react"
import { useTranslations } from "next-intl"
import { qlooTag } from "@/components/brands/qloo-logo"
import { CallDetails } from "@/components/qloo/call-details"

/**
 * The because chip (rule 1): which love drove this pick, by how much, and the Qloo call behind it.
 * Public pages show the love only.
 */
export function BecauseChip({
  because,
  callId,
  publicView = false,
}: {
  because: StoredPick["because"]
  callId: string | null
  publicView?: boolean
}) {
  const t = useTranslations("Pick")
  const te = useTranslations("Evidence")
  if (!because) return null
  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("because", { name: because.name })}
        title={t("because", { name: because.name })}
        className="inline-flex max-w-full items-center gap-1.5 rounded-tag bg-raised px-2 py-1 text-start text-[11px] leading-tight text-text-2 shadow-sticker transition-colors hover:text-foreground"
      >
        <Heart aria-hidden className="size-3 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{because.name}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 rounded-card border-0 bg-popover text-popover-foreground shadow-float"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">
            {because.share != null
              ? t("share", { share: Math.round(because.share * 100), name: because.name })
              : t("because", { name: because.name })}
          </p>
          {publicView || !callId ? (
            <p className="text-xs text-text-3">
              {te.rich("publicNote", qlooTag("mx-0.5 text-text-2"))}
            </p>
          ) : (
            <>
              <p className="text-[11px] font-medium tracking-[0.08em] text-text-3 uppercase">
                {te.rich("title", qlooTag("mx-0.5 h-[0.9em]"))}
              </p>
              <CallDetails callId={callId} />
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
