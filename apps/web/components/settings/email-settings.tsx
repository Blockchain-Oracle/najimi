"use client"

import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { api } from "@/lib/fetcher"

/*
 * Which emails come: "your week in taste" on Sunday evenings, and news about your bookings and
 * plans (outcomes, reminders). Sign-in codes always come; they're how you get in.
 */

type Prefs = { weekly: boolean; news: boolean }
const KINDS = ["weekly", "news"] as const

export function EmailSettings() {
  const t = useTranslations("Email")
  const queryClient = useQueryClient()
  const state = useQuery({
    queryKey: ["me-email"],
    queryFn: () => api<{ email: string | null; prefs: Prefs }>("/api/me/email"),
  })
  if (!state.data) return <div className="h-28 animate-pulse rounded-card bg-secondary" aria-busy />
  const { email, prefs } = state.data

  const set = async (kind: (typeof KINDS)[number], on: boolean) => {
    queryClient.setQueryData(["me-email"], { email, prefs: { ...prefs, [kind]: on } })
    await api("/api/me/email", { method: "PATCH", json: { [kind]: on } }).catch(() => {
      queryClient.setQueryData(["me-email"], { email, prefs })
      toast.error(t("failed"))
    })
  }

  return (
    <div className="flex flex-col gap-1">
      {email ? <p className="pb-3 text-[14px] text-text-3">{t("to", { email })}</p> : null}
      {KINDS.map((kind) => (
        <div key={kind} className="flex items-center gap-3 rounded-tile py-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold">{t(`${kind}.title`)}</span>
            <span className="text-[13px] text-text-3">{t(`${kind}.hint`)}</span>
          </span>
          <Switch
            aria-label={t(`${kind}.title`)}
            checked={prefs[kind]}
            onCheckedChange={(on) => void set(kind, on)}
          />
        </div>
      ))}
      <p className="pt-2 text-[13px] text-text-3">{t("codes")}</p>
    </div>
  )
}
