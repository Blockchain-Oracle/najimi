"use client"

import { Button } from "@najimi/ui/components/button"
import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"

/**
 * Delete all my data (T21): one button, one plain confirmation that says what goes, then a clean
 * start at the front door. Nothing is kept and it can't be undone.
 */
export function DeleteData() {
  const t = useTranslations("Settings")
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const confirm = () =>
    startDelete(async () => {
      setError(null)
      try {
        await api("/api/me", { method: "DELETE" })
        await authClient.signOut().catch(() => undefined)
        window.location.assign("/")
      } catch (e) {
        setError(e instanceof Error ? e.message : t("deleteFailed"))
      }
    })

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} className="self-start">
        {t("delete")}
      </Button>
      <Dialog open={open} onOpenChange={(next) => (deleting ? null : setOpen(next))}>
        <DialogContent className="max-w-md rounded-sheet border-0 bg-card p-5 text-card-foreground sm:max-w-md">
          <DialogTitle className="font-title text-2xl">{t("deleteTitle")}</DialogTitle>
          <p className="text-[15px] leading-relaxed">{t("deleteWhat")}</p>
          <p className="text-sm text-paper-muted">{t("deleteFinal")}</p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              className="text-paper-foreground hover:bg-paper-foreground/8"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              {t("keep")}
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={deleting}>
              {deleting ? t("deleting") : t("deleteConfirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
