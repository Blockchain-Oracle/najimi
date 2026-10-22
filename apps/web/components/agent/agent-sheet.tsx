"use client"

import { Dialog } from "@base-ui/react/dialog"
import type { NajimiUIMessage } from "@najimi/agent"
import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, Eye, Maximize2, Plus, Square, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Message } from "@/components/chat/message"
import { api } from "@/lib/fetcher"
import { type RoomStatus, useRoom } from "@/lib/use-room"
import { useAgent } from "./agent-context"

/*
 * Najimi on every screen (W6): a sheet over whatever you're on (a bottom sheet on a phone, a
 * panel on the right on desktop), carrying on your latest conversation. It knows what you're
 * looking at (the feed's card), shown as a chip, and sends it with what you ask. After Meta AI's
 * and Perplexity's in-context assistants (Refero 9fc66616, dd3d7374): the run's steps stream in
 * the thread, the input stays at the bottom with Stop.
 */

type Latest = {
  chatId: string
  title: string | null
  messages: NajimiUIMessage[]
  status: RoomStatus
  after: number
}

function SheetRoom({ latest, me, onFresh }: { latest: Latest; me: string; onFresh: () => void }) {
  const t = useTranslations("Agent")
  const { screen, setOpen } = useAgent()
  const queryClient = useQueryClient()
  const [text, setText] = useState("")
  const room = useRoom({
    chatId: latest.chatId,
    initial: latest.messages,
    initialStatus: latest.status,
    after: latest.after,
    me,
  })
  const scroller = useRef<HTMLDivElement>(null)
  const lastLength = room.messages.at(-1)?.parts.length ?? 0
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows new messages as they grow
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" })
  }, [room.messages.length, lastLength])

  const send = async () => {
    const value = text.trim()
    if (!value || room.busy) return
    setText("")
    const ok = await room.send(value, [], screen ?? undefined)
    if (ok) void queryClient.invalidateQueries({ queryKey: ["chats"] })
    else setText(value)
  }

  return (
    <>
      <header className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Orb size={30} working={room.busy} />
        <Dialog.Title className="flex-1 text-[16px] font-semibold">{t("title")}</Dialog.Title>
        <button
          type="button"
          onClick={onFresh}
          aria-label={t("new")}
          title={t("new")}
          className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-card hover:text-foreground"
        >
          <Plus className="size-5" />
        </button>
        {room.messages.length ? (
          <Link
            href={`/c/${latest.chatId}`}
            onClick={() => setOpen(false)}
            aria-label={t("full")}
            title={t("full")}
            className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-card hover:text-foreground"
          >
            <Maximize2 className="size-4.5" />
          </Link>
        ) : null}
        <Dialog.Close
          aria-label={t("close")}
          className="grid size-9 place-items-center rounded-full text-text-2 hover:bg-card hover:text-foreground"
        >
          <X className="size-5" />
        </Dialog.Close>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4">
        {room.messages.length ? (
          <div className="flex flex-col gap-6 py-3">
            {room.messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                streaming={i === room.messages.length - 1 && m.metadata?.status === "streaming"}
                actions={{
                  live: m.metadata?.status === "waiting",
                  onAsk: (ask) => void room.send(ask, [], screen ?? undefined),
                  onAnswer: (toolCallId, output) => void room.answer(m.id, toolCallId, output),
                  onApprove: (id, approved) => void room.approve(m.id, id, approved),
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
            <Orb size={72} />
            <p className="max-w-xs text-[15px] text-text-2">{screen ? t("emptyOn") : t("empty")}</p>
          </div>
        )}
        {room.error ? <p className="pb-2 text-sm text-destructive">{room.error}</p> : null}
      </div>

      <div className="flex flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {screen ? (
          <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-pill bg-card px-2.5 py-1 text-[12px] text-text-2">
            <Eye className="size-3.5 shrink-0" />
            <span className="truncate">{t("seeing", { label: screen.label })}</span>
          </span>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
          className="flex items-end gap-2 rounded-card bg-card p-2 ring-1 ring-border focus-within:ring-2 focus-within:ring-ring"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            rows={1}
            placeholder={screen ? t("askAbout") : t("placeholder")}
            aria-label={t("placeholder")}
            className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-text-4"
          />
          {room.busy ? (
            <button
              type="button"
              onClick={() => void room.stop()}
              aria-label={t("stop")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <Square className="size-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label={t("send")}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-5" />
            </button>
          )}
        </form>
      </div>
    </>
  )
}

export function AgentSheet({ me }: { me: string | null }) {
  const { open, setOpen } = useAgent()
  const [fresh, setFresh] = useState(0)
  const latest = useQuery({
    queryKey: ["agent-room", fresh],
    queryFn: () => api<Latest>(`/api/rooms/latest${fresh ? "?new=1" : ""}`),
    enabled: open && Boolean(me),
    staleTime: 0,
  })
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-black/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 md:bg-black/20" />
        <Dialog.Popup
          className={cn(
            "fixed z-[71] flex flex-col overflow-hidden bg-background text-foreground shadow-float transition duration-300 ease-out",
            "inset-x-0 bottom-0 h-[85dvh] rounded-t-sheet data-ending-style:translate-y-full data-starting-style:translate-y-full",
            "md:inset-y-3 md:end-3 md:start-auto md:h-auto md:w-[26rem] md:rounded-sheet md:data-ending-style:translate-x-[110%] md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-[110%] md:data-starting-style:translate-y-0",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" />
          {latest.data && me ? (
            <SheetRoom
              key={latest.data.chatId}
              latest={latest.data}
              me={me}
              onFresh={() => setFresh((n) => n + 1)}
            />
          ) : (
            <div className="grid flex-1 place-items-center">
              <Orb size={64} working />
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
