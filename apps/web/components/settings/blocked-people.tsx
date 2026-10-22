"use client"

import { toast } from "@najimi/ui/components/sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"

type Blocked = { userId: string; name: string | null; look: string | null; username: string | null }

/** The people you blocked, each with Unblock (W25). */
export function BlockedPeople() {
  const t = useTranslations("Settings")
  const client = useQueryClient()
  const list = useQuery({
    queryKey: ["blocked"],
    queryFn: () => api<{ blocked: Blocked[] }>("/api/people/block"),
  })
  const unblock = async (userId: string) => {
    await api("/api/people/block", { method: "DELETE", json: { userId } })
      .then(() => {
        toast(t("unblocked"))
        void client.invalidateQueries({ queryKey: ["blocked"] })
      })
      .catch(() => toast.error(t("saveFailed")))
  }
  const rows = list.data?.blocked ?? []
  if (!rows.length) return <p className="text-sm text-paper-muted">{t("noBlocked")}</p>
  return (
    <ul className="flex flex-col divide-y divide-paper-foreground/8">
      {rows.map((b) => (
        <li key={b.userId} className="flex items-center gap-3 py-2.5">
          <Face look={b.look} name={b.name ?? "?"} size="sm" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {b.name ?? b.username ?? "—"}
            {b.username ? <span className="ms-2 text-text-3">@{b.username}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => void unblock(b.userId)}
            className="shrink-0 rounded-pill px-3 py-1 text-xs font-semibold ring-1 ring-paper-foreground/15 transition-colors hover:bg-paper-foreground/5"
          >
            {t("unblock")}
          </button>
        </li>
      ))}
    </ul>
  )
}
