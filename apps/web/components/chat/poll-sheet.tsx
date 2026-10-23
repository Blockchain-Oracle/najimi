"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

/** A new poll: the question and two to four choices; it lands in the thread for everyone. */
export function PollSheet({
  open,
  onOpenChange,
  chatId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
}) {
  const t = useTranslations("Polls")
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [busy, setBusy] = useState(false)
  const filled = options.map((o) => o.trim()).filter(Boolean)
  const ready = question.trim().length >= 3 && filled.length >= 2

  const start = async () => {
    if (!ready || busy) return
    setBusy(true)
    try {
      await api(`/api/rooms/${chatId}/polls`, {
        json: { question: question.trim(), options: filled.map((label) => ({ label })) },
      })
      setQuestion("")
      setOptions(["", ""])
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setBusy(false)
    }
  }

  const field =
    "h-11 w-full rounded-tile bg-secondary px-3.5 text-[15px] outline-none ring-1 ring-transparent focus:ring-white/20"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:mx-auto md:max-w-lg"
      >
        <SheetTitle className="pt-5 font-title text-[1.6rem] font-normal">{t("title")}</SheetTitle>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void start()
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 140))}
            placeholder={t("questionPlaceholder")}
            aria-label={t("question")}
            className={field}
          />
          {options.map((o, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the choices are fixed slots
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) =>
                  setOptions((all) =>
                    all.map((x, j) => (j === i ? e.target.value.slice(0, 60) : x)),
                  )
                }
                placeholder={t("option", { n: i + 1 })}
                aria-label={t("option", { n: i + 1 })}
                className={field}
              />
              {options.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setOptions((all) => all.filter((_, j) => j !== i))}
                  aria-label={t("remove")}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-text-3 hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          {options.length < 4 ? (
            <button
              type="button"
              onClick={() => setOptions((all) => [...all, ""])}
              className="flex w-fit items-center gap-1.5 rounded-pill px-2 py-1 text-[14px] font-semibold text-text-2 hover:text-foreground"
            >
              <Plus className="size-4" /> {t("addOption")}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={!ready || busy}
            className="mt-1 h-12 rounded-pill bg-primary text-[15px] font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {t("start")}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
