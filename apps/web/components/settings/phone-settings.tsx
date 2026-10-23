"use client"

import { Button, buttonVariants } from "@najimi/ui/components/button"
import { Input } from "@najimi/ui/components/input"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Phone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * Your phone, so you can add Najimi to a call you're already on: save your number, confirm it by
 * calling Najimi once from it, then on any call tap Add call, dial Najimi and merge. It listens and
 * answers when you say its name; what it finds lands in a chat of its own.
 */

type State = { phone: string | null; confirmed: boolean; najimi: string | null }

export function PhoneSettings() {
  const t = useTranslations("Phone")
  const queryClient = useQueryClient()
  const state = useQuery({ queryKey: ["me-phone"], queryFn: () => api<State>("/api/me/phone") })
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const save = async (method: "PUT" | "DELETE") => {
    setBusy(true)
    try {
      const next = await api<State>("/api/me/phone", {
        method,
        json: method === "PUT" ? { phone: draft } : {},
      })
      queryClient.setQueryData(["me-phone"], next)
      setEditing(false)
      setDraft("")
      if (method === "PUT") sound("promote")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("failed"))
    } finally {
      setBusy(false)
    }
  }

  if (!state.data) return <div className="h-24 animate-pulse rounded-card bg-secondary" aria-busy />
  const { phone, confirmed, najimi } = state.data
  if (!najimi) return <p className="text-[15px] text-text-2">{t("off")}</p>

  if (!phone || editing)
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save("PUT")
        }}
      >
        <Input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+234 801 234 5678"
          aria-label={t("yourNumber")}
          className="h-12 text-base"
        />
        <Button type="submit" size="lg" disabled={busy || draft.trim().length < 8}>
          {busy ? <Loader2 className="animate-spin" /> : null}
          {t("save")}
        </Button>
      </form>
    )

  const tel = `tel:${najimi}`
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-tile bg-background px-4 py-3 ring-1 ring-border">
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full",
            confirmed ? "bg-primary text-primary-foreground" : "bg-secondary text-text-2",
          )}
        >
          {confirmed ? <Check className="size-4" /> : <Phone className="size-4" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="tnum text-[15px] font-semibold">{phone}</span>
          <span className="text-[13px] text-text-3">
            {confirmed ? t("confirmed") : t("notConfirmed")}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[13px] font-semibold text-text-2 hover:text-foreground"
        >
          {t("change")}
        </button>
      </div>

      {confirmed ? (
        <ol className="flex flex-col gap-3">
          {(["step1", "step2", "step3"] as const).map((step, i) => (
            <li key={step} className="flex items-start gap-3 text-[15px]">
              <span className="tnum grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
                {i + 1}
              </span>
              <span>{t(step, { number: najimi })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-[15px] text-text-2">{t("confirmHow")}</p>
      )}

      <a href={tel} className={cn(buttonVariants({ size: "lg" }), "tnum")}>
        <Phone />
        {confirmed ? t("callNajimi", { number: najimi }) : t("confirmCall", { number: najimi })}
      </a>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save("DELETE")}
        className="self-center text-[13px] font-semibold text-text-3 hover:text-destructive"
      >
        {t("remove")}
      </button>
    </div>
  )
}
