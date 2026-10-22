"use client"

import { Button } from "@najimi/ui/components/button"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState, useTransition } from "react"
import { api } from "@/lib/fetcher"

const field =
  "w-full rounded-tile bg-paper px-3.5 py-2.5 text-paper-foreground outline-none ring-1 ring-paper-foreground/10 placeholder:text-paper-muted focus:ring-2 focus:ring-ring"

type Draft = { name: string; description: string; instructions: string }

/**
 * Save a chat that went well as a workflow of one's own (T15). Najimi drafts the steps from the
 * chat; the person edits them, and can open it to anyone with the link.
 */
export function SaveWorkflowDialog({
  chatId,
  version,
  open,
  onOpenChange,
}: {
  chatId: string
  /** The chat's length: a chat that went on gets a fresh draft. */
  version: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Workflows")
  const router = useRouter()
  const draft = useQuery({
    queryKey: ["workflow-draft", chatId, version],
    queryFn: () => api<Draft>("/api/workflows/draft", { json: { chatId } }),
    enabled: open,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
  const [form, setForm] = useState<Draft>({ name: "", description: "", instructions: "" })
  const [anyone, setAnyone] = useState(false)
  const [saving, startSave] = useTransition()

  // The draft fills the form once; after that the words are the person's.
  useEffect(() => {
    if (draft.data) setForm(draft.data)
  }, [draft.data])

  const save = () =>
    startSave(async () => {
      try {
        const { slug } = await api<{ slug: string }>("/api/workflows", {
          json: { chatId, ...form, public: anyone },
        })
        onOpenChange(false)
        const link = new URL(`/w/${slug}`, window.location.origin).toString()
        if (anyone) await navigator.clipboard.writeText(link).catch(() => undefined)
        toast(t("saved"), {
          description: anyone ? t("savedShared", { link }) : t("savedPrivate"),
          action: { label: t("seeYours"), onClick: () => router.push("/workflows") },
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("saveFailed"))
      }
    })

  const ready = form.name.trim().length >= 2 && form.instructions.trim().length >= 10

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto rounded-sheet border-0 bg-card p-5 text-card-foreground sm:max-w-lg">
        <DialogTitle className="font-title text-2xl">{t("saveTitle")}</DialogTitle>
        <p className="-mt-2 text-sm text-paper-muted">{t("saveHint")}</p>
        {draft.isPending && !form.name ? (
          <div className="flex flex-col gap-3" aria-busy>
            <p className="flex items-center gap-2 text-sm text-paper-muted">
              <span className="size-2 animate-signal-pulse rounded-full bg-signal" />{" "}
              {t("drafting")}
            </p>
            <div className="h-11 animate-pulse rounded-tile bg-paper-foreground/8" />
            <div className="h-11 animate-pulse rounded-tile bg-paper-foreground/8" />
            <div className="h-36 animate-pulse rounded-tile bg-paper-foreground/8" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {draft.isError ? (
              <p className="text-sm text-destructive">{draft.error.message}</p>
            ) : null}
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("name")}
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={80}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("description")}
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={240}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              {t("steps")}
              <textarea
                value={form.instructions}
                onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                maxLength={2000}
                rows={7}
                className={`${field} resize-y leading-relaxed`}
              />
              <span className="text-xs font-normal text-paper-muted">{t("stepsHint")}</span>
            </label>
            <div className="flex items-center gap-3 text-sm font-semibold">
              <Switch checked={anyone} onCheckedChange={setAnyone} aria-label={t("public")} />
              {t("public")}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                className="text-paper-foreground hover:bg-paper-foreground/8"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button onClick={save} disabled={!ready || saving}>
                {saving ? t("saving") : t("save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
