"use client"

import type { TuneUpItem } from "@najimi/db/schema"
import { SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { Check, Copy } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { BrandIcon } from "@/components/brands/brand-icon"
import { platformOf } from "./platforms"

/*
 * Your taste as topics for a platform's own feed controls (Instagram's Your Algorithm, TikTok's
 * Manage topics): tap a word to copy it, add it there, and it's ticked here.
 */

export function TopicsSheet({
  item,
  onDone,
}: {
  item: TuneUpItem
  onDone: (done: boolean) => void
}) {
  const t = useTranslations("Connect")
  const p = platformOf(item.platform)
  const [copied, setCopied] = useState<Set<string>>(new Set())
  const words = item.words ?? []

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied((s) => new Set(s).add(key))
    toast(t("copied"))
  }

  return (
    <div className="flex flex-col gap-5 pt-5">
      <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
          <BrandIcon icon={p.icon} colored className="size-5" />
        </span>{" "}
        {t("teach", { name: p.name })}
      </SheetTitle>
      <p className="text-[14px] text-text-2">{item.why}</p>
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => void copy(w, w)}
            className={cn(
              "flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-[14px] font-semibold ring-1 transition-colors",
              copied.has(w) ? "bg-success/12 text-success ring-success/30" : "bg-card ring-border",
            )}
          >
            {copied.has(w) ? <Check className="size-3.5" /> : null}
            {w}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void copy(words.join(", "), "*")}
          className="flex h-12 items-center justify-center gap-2 rounded-pill bg-card font-heading text-[15px] ring-1 ring-border"
        >
          <Copy className="size-4" /> {t("copyAll")}
        </button>
        <button
          type="button"
          onClick={() => onDone(!item.done)}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-pill font-heading text-[15px]",
            item.done ? "bg-success text-black" : "bg-primary text-primary-foreground",
          )}
        >
          <Check className="size-4" /> {item.done ? t("doneIt") : t("markDone")}
        </button>
      </div>
    </div>
  )
}
