"use client"

import { CALLS } from "@najimi/config"
import { Phone, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { ring } from "@/lib/sounds"

/*
 * Someone in one of your circles or DMs started a call while you have Najimi open: a banner at the
 * top rings (like a phone) with Join and Not now, on whatever screen you're on. Join opens that
 * chat's call; it stops ringing on its own after a while.
 */

type Incoming = { chatId: string; callId: string; who: string; chat: string | null }

/** Asks the chat view that's showing this chat to open its call (when it's already on screen). */
export const JOIN_CALL_EVENT = "najimi:join-call"

export function IncomingCall() {
  const t = useTranslations("Call")
  const router = useRouter()
  const session = authClient.useSession()
  const userId = session.data?.user.id
  const [call, setCall] = useState<Incoming | null>(null)

  useEffect(() => {
    if (!userId) return
    // Only what happens from now on: an old call never rings.
    const source = new EventSource("/api/me/live?after=now")
    source.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as {
        type: string
        data?: { kind?: string; call?: Incoming }
      }
      if (event.type === "notification" && event.data?.kind === "call" && event.data.call)
        setCall(event.data.call)
    }
    return () => source.close()
  }, [userId])

  useEffect(() => {
    if (!call) return
    const stop = ring("in")
    const timer = setTimeout(() => setCall(null), CALLS.ringMs)
    return () => {
      stop()
      clearTimeout(timer)
    }
  }, [call])

  const join = () => {
    if (!call) return
    const here = window.location.pathname.endsWith(`/c/${call.chatId}`)
    setCall(null)
    if (here) window.dispatchEvent(new CustomEvent(JOIN_CALL_EVENT, { detail: call.chatId }))
    else router.push(`/c/${call.chatId}?call=1`)
  }

  return (
    <AnimatePresence>
      {call ? (
        <motion.div
          key={call.callId}
          role="alertdialog"
          aria-label={
            call.chat
              ? t("incomingIn", { who: call.who, chat: call.chat })
              : t("incoming", { who: call.who })
          }
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="dark fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[80] mx-auto flex max-w-md items-center gap-3 rounded-card bg-[#0b0b0d] p-3 pl-4 text-foreground shadow-2xl ring-1 ring-white/10"
        >
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-success text-white">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-full bg-success/40"
            />
            <Phone className="relative size-4" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading text-[15px]">
              {t("incoming", { who: call.who })}
            </span>
            {call.chat ? (
              <span className="truncate text-[13px] text-text-3">{call.chat}</span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label={t("decline")}
            title={t("decline")}
            onClick={() => setCall(null)}
            className="grid size-10 place-items-center rounded-full bg-white/10 text-white"
          >
            <X className="size-4" />
          </button>
          <button
            type="button"
            onClick={join}
            className="flex h-10 items-center gap-1.5 rounded-pill bg-success px-4 text-[14px] font-semibold text-white"
          >
            <Phone className="size-4" /> {t("join")}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
