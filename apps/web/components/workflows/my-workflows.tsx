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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((w) => {
        const isOpen = open.get(w.id) ?? w.public
        return (
          <div
            key={w.id}
            className="flex flex-col overflow-hidden rounded-card bg-card text-card-foreground shadow-paper"
          >
            <div className="relative grid h-20 place-items-center bg-lime text-black">
              <ListChecks className="size-8" />
              {isOpen ? <CopyLinkButton slug={w.slug} className="absolute end-3 top-3" /> : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                {t("stepCount", { count: w.steps })}
                {w.runsCount ? ` · ${t("runs", { count: w.runsCount })}` : ""}
              </p>
              <h3 className="font-title text-xl leading-tight">{w.name}</h3>
              {w.description ? <p className="text-sm text-paper-muted">{w.description}</p> : null}
              <div className="mt-1 flex items-center gap-2 text-xs font-semibold">
                <Switch
                  checked={isOpen}
                  onCheckedChange={(v) => void setPublic(w.id, v)}
                  aria-label={t("public")}
                />
                {t("public")}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-2">
                <button
                  type="button"
                  aria-label={t("delete")}
                  title={t("delete")}
                  onClick={() => void remove(w)}
                  className="grid size-8 place-items-center rounded-full text-paper-muted transition-colors hover:bg-paper-foreground/8 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
                <Link
                  href={`/c?workflow=${w.slug}`}
                  className="ms-auto rounded-pill bg-lime px-3 py-1 text-xs font-semibold text-lime-foreground"
                >
                  {t("run")}
                </Link>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
