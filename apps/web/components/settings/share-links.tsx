"use client"

import { toast } from "@najimi/ui/components/sonner"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

export type ShareItem = {
  token: string
  kind: "creation" | "chat" | "person"
  label: string
  createdAt: string
}

/** Every live link the person made (T19), and a way to stop each one at once. */
export function ShareLinks({ items }: { items: ShareItem[] }) {
  const t = useTranslations("Settings")
  const router = useRouter()
  const [gone, setGone] = useState<Set<string>>(new Set())
  const live = items.filter((i) => !gone.has(i.token))

  const stop = async (token: string) => {
    setGone(new Set(gone).add(token))
    await api(`/api/shares/${token}`, { method: "DELETE" })
      .then(() => {
        toast(t("stopped"))
        router.refresh()
      })
      .catch(() => {
        const back = new Set(gone)
        back.delete(token)
        setGone(back)
        toast.error(t("saveFailed"))
      })
  }

  if (!live.length) return <p className="text-sm text-paper-muted">{t("noLinks")}</p>
  return (
    <ul className="flex flex-col divide-y divide-paper-foreground/8">
      {live.map((i) => (
        <li key={i.token} className="flex items-center gap-3 py-2.5">
          <span className="w-20 shrink-0 text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {t(`kinds.${i.kind}`)}
          </span>
          <a
            href={`/s/${i.token}`}
            target="_blank"
            rel="noopener"
            className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline"
          >
            {i.label}
          </a>
          <button
            type="button"
            onClick={() => void stop(i.token)}
            className="shrink-0 rounded-pill px-3 py-1 text-xs font-semibold text-destructive ring-1 ring-destructive/30 transition-colors hover:bg-destructive/8"
          >
            {t("stop")}
          </button>
        </li>
      ))}
    </ul>
  )
}
