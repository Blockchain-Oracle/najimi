"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

type Mode = "ask" | "auto" | "plan"
const MODES: Mode[] = ["ask", "auto", "plan"]

/** How new chats make images and videos (rule 6); each chat can still change its own. */
export function ModePicker({ initial }: { initial: Mode }) {
  const t = useTranslations("Chat")
  const ts = useTranslations("Settings")
  const [mode, setMode] = useState<Mode>(initial)

  const pick = async (next: Mode) => {
    const before = mode
    setMode(next)
    await api("/api/me", { method: "PATCH", json: { mode: next } })
      .then(() => toast(ts("saved")))
      .catch(() => {
        setMode(before)
        toast.error(ts("saveFailed"))
      })
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{ts("mode")}</legend>
      {MODES.map((m) => (
        <label
          key={m}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-tile px-4 py-3 ring-1 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
            mode === m
              ? "bg-lime/25 ring-2 ring-lime-ink"
              : "ring-paper-foreground/10 hover:bg-paper-foreground/5",
          )}
        >
          <input
            type="radio"
            name="default-mode"
            value={m}
            checked={mode === m}
            onChange={() => void pick(m)}
            className="mt-1 size-4 shrink-0 accent-lime-ink [color-scheme:light]"
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold">{t(`modes.${m}`)}</span>
            <span className="text-sm text-paper-muted">{t(`modeHints.${m}`)}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
