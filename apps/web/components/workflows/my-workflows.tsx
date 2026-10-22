"use client"

import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { ListChecks, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { CopyLinkButton } from "./copy-link-button"

export type MyWorkflow = {
  id: string
  slug: string
  name: string
  description: string
  steps: number
  public: boolean
  runsCount: number
}

/** The workflows a person saved from their chats: run, open to anyone with the link, or delete. */
export function MyWorkflows({ items }: { items: MyWorkflow[] }) {
  const t = useTranslations("Workflows")
  const router = useRouter()
  const [open, setOpen] = useState(() => new Map(items.map((w) => [w.id, w.public])))

  const setPublic = async (id: string, value: boolean) => {
    setOpen(new Map(open).set(id, value))
    await api(`/api/workflows/${id}`, { method: "PATCH", json: { public: value } }).catch(() => {
      setOpen(new Map(open).set(id, !value))
      toast.error(t("saveFailed"))
    })
  }
  const remove = async (w: MyWorkflow) => {
    if (!window.confirm(t("deleteConfirm", { name: w.name }))) return
    await api(`/api/workflows/${w.id}`, { method: "DELETE" })
      .then(() => router.refresh())
      .catch(() => toast.error(t("saveFailed")))
  }

  return (
    <ul className="overflow-hidden rounded-card bg-card shadow-paper">
      {items.map((w) => {
        const isOpen = open.get(w.id) ?? w.public
        return (
          <li
            key={w.id}
            className="flex flex-col gap-2 border-b border-border px-4 py-3.5 last:border-b-0"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-tile bg-raised shadow-sticker">
                <ListChecks className="size-[18px] text-text-2" strokeWidth={1.5} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-heading text-[15px]">{w.name}</span>
                {w.description ? (
                  <span className="line-clamp-2 text-[13px] text-text-3">{w.description}</span>
                ) : null}
                <span className="mt-1 font-mono text-[11px] text-text-3">
                  {t("stepCount", { count: w.steps })}
                  {w.runsCount ? ` · ${t("runs", { count: w.runsCount })}` : ""}
                </span>
              </span>
              <Link
                href={`/c?workflow=${w.slug}`}
                className="mt-1 shrink-0 rounded-pill bg-ink px-3 py-1 text-xs font-semibold text-on-ink"
              >
                {t("run")}
              </Link>
            </div>
            <div className="flex items-center gap-2 ps-12 text-xs text-text-2">
              <Switch
                checked={isOpen}
                onCheckedChange={(v) => void setPublic(w.id, v)}
                aria-label={t("public")}
              />
              {t("public")}
              {isOpen ? <CopyLinkButton slug={w.slug} /> : null}
              <button
                type="button"
                aria-label={t("delete")}
                title={t("delete")}
                onClick={() => void remove(w)}
                className="ms-auto grid size-8 place-items-center rounded-full text-text-3 transition-colors hover:bg-white/4 hover:text-destructive"
              >
                <Trash2 className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
