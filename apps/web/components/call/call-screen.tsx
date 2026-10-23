"use client"

import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
  useIsSpeaking,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react"
import { CALLS } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { DisconnectReason, type Participant } from "livekit-client"
import { Loader2, Mic, MicOff, PhoneOff, Sparkles, UserPlus } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useRef, useState } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { ring, sound } from "@/lib/sounds"

/*
 * A call in a circle or DM, full screen and dark: everyone's face with a ring while they speak,
 * Najimi as its orb once it's brought in (it listens, and answers when someone says its name;
 * what it finds lands in the chat), and round controls: mute, bring Najimi, invite (circles),
 * end. While you're alone it rings like a phone; leaving last ends the call for everyone.
 */

type Member = { userId: string; name: string; look: string | null }
type Pass = { token: string; url: string; call: { id: string; najimi: boolean } }

/** Ways a call ends that close the screen; any other disconnect is a dropped line (rejoin). */
const CLOSING = new Set<DisconnectReason | undefined>([
  undefined,
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.ROOM_DELETED,
  DisconnectReason.ROOM_CLOSED,
])

/** Leaving tells the server, so a call you were last in ends at once (even as the page closes). */
const leave = (chatId: string) => {
  const url = `/api/rooms/${chatId}/call/leave`
  if (navigator.sendBeacon?.(url)) return
  void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined)
}

function Tile({ participant, member }: { participant: Participant; member?: Member }) {
  const t = useTranslations("Call")
  const speaking = useIsSpeaking(participant)
  const muted = !participant.isMicrophoneEnabled
  if (participant.isAgent)
    return (
      <li className="flex flex-col items-center gap-2">
        <span className={cn("rounded-full transition-transform", speaking && "scale-110")}>
          <Orb size={92} working={speaking} />
        </span>
        <span className="text-[14px] font-semibold">Najimi</span>
        <span className="text-[12px] text-white/50">
          {speaking ? t("speaking") : t("listening")}
        </span>
      </li>
    )
  return (
    <li className="flex flex-col items-center gap-2">
      <span
        className={cn(
          "rounded-full p-1 ring-2 transition-colors",
          speaking ? "ring-white" : "ring-transparent",
        )}
      >
        <Face
          look={member?.look ?? null}
          name={member?.name ?? participant.name ?? "?"}
          size="xl"
        />
      </span>
      <span className="flex items-center gap-1 text-[14px] font-semibold">
        {participant.isLocal ? t("you") : (member?.name ?? participant.name)}
        {muted ? <MicOff className="size-3.5 text-white/50" /> : null}
      </span>
    </li>
  )
}

/** A round control with its name under it. */
function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-16 flex-col items-center gap-1.5">
      {children}
      <span className="text-center text-[11px] leading-tight text-white/60">{label}</span>
    </div>
  )
}

function Room({
  chatId,
  kind,
  title,
  members,
  najimiAsked,
  onLeave,
}: {
  chatId: string
  kind: "circle" | "dm"
  title: string
  members: Member[]
  najimiAsked: boolean
  onLeave: () => void
}) {
  const t = useTranslations("Call")
  const room = useRoomContext()
  const people = useParticipants()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const byId = new Map(members.map((m) => [m.userId, m]))
  const najimiHere = people.some((p) => p.isAgent)
  const others = people.filter((p) => !p.isAgent && !p.isLocal).length

  // Najimi on its way: shown for a while, then the button comes back if it never arrived.
  const [asking, setAsking] = useState(false)
  const [askedAt, setAskedAt] = useState<number | null>(najimiAsked ? Date.now() : null)
  const [najimiFailed, setNajimiFailed] = useState(false)
  useEffect(() => {
    if (najimiHere) {
      setAskedAt(null)
      setNajimiFailed(false)
      return
    }
    if (askedAt == null) return
    const timer = setTimeout(
      () => {
        setAskedAt(null)
        setNajimiFailed(true)
      },
      Math.max(0, askedAt + CALLS.najimiJoinMs - Date.now()),
    )
    return () => clearTimeout(timer)
  }, [askedAt, najimiHere])

  // It rings while nobody else has come, for as long as a phone would.
  const [ringing, setRinging] = useState(true)
  // Someone came, or Najimi did: nothing left to ring for.
  useEffect(() => {
    if (others > 0 || najimiHere) setRinging(false)
  }, [others, najimiHere])
  useEffect(() => {
    if (!ringing) return
    const stop = ring("out")
    const timer = setTimeout(() => setRinging(false), CALLS.ringMs)
    return () => {
      stop()
      clearTimeout(timer)
    }
  }, [ringing])

  // Closing the page counts as leaving.
  useEffect(() => {
    const gone = () => leave(chatId)
    window.addEventListener("pagehide", gone)
    return () => window.removeEventListener("pagehide", gone)
  }, [chatId])

  const bring = async () => {
    setAsking(true)
    setNajimiFailed(false)
    try {
      await api(`/api/rooms/${chatId}/call/najimi`, { json: {} })
      setAskedAt(Date.now())
      sound("promote")
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setAsking(false)
    }
  }

  const invite = async () => {
    try {
      const { invite: path } = await api<{ invite: string | null }>(`/api/rooms/${chatId}/members`)
      if (!path) return toast(t("failed"))
      const url = `${window.location.origin}${path}`
      if (navigator.share) await navigator.share({ title, text: t("inviteText", { title }), url })
      else {
        await navigator.clipboard.writeText(url)
        toast(t("inviteCopied"))
      }
    } catch {
      // The share sheet was closed: nothing to do.
    }
  }

  const status = najimiHere
    ? others > 0
      ? t("sayName")
      : t("justTalk")
    : askedAt != null
      ? t("najimiComing")
      : najimiFailed
        ? t("najimiFailed")
        : others > 0
          ? t("together")
          : ringing
            ? t("ringing")
            : t("nobody")

  const round = "grid size-16 place-items-center rounded-full transition-colors"
  return (
    <div className="flex h-full flex-col">
      <ul className="grid flex-1 content-center justify-items-center gap-x-6 gap-y-10 px-6 [grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))]">
        {people.map((p) => (
          <Tile key={p.identity} participant={p} member={byId.get(p.identity)} />
        ))}
      </ul>
      <p className="px-6 pb-4 text-center text-[13px] text-white/60" aria-live="polite">
        {status}
      </p>
      <div className="flex items-start justify-center gap-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Control label={isMicrophoneEnabled ? t("mute") : t("unmute")}>
          <button
            type="button"
            aria-label={isMicrophoneEnabled ? t("mute") : t("unmute")}
            onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
            className={cn(round, isMicrophoneEnabled ? "bg-white/12" : "bg-white text-black")}
          >
            {isMicrophoneEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
          </button>
        </Control>
        {najimiHere || askedAt != null ? null : (
          <Control label={t("bringShort")}>
            <button
              type="button"
              aria-label={t("bring")}
              onClick={() => void bring()}
              disabled={asking}
              className={cn(round, "bg-white text-black disabled:opacity-60")}
            >
              {asking ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <Sparkles className="size-6" />
              )}
            </button>
          </Control>
        )}
        {kind === "circle" ? (
          <Control label={t("invite")}>
            <button
              type="button"
              aria-label={t("invite")}
              onClick={() => void invite()}
              className={cn(round, "bg-white/12")}
            >
              <UserPlus className="size-6" />
            </button>
          </Control>
        ) : null}
        <Control label={t("end")}>
          <button
            type="button"
            aria-label={t("leave")}
            onClick={() => {
              leave(chatId)
              void room.disconnect()
              onLeave()
            }}
            className={cn(round, "bg-destructive text-white")}
          >
            <PhoneOff className="size-6" />
          </button>
        </Control>
      </div>
    </div>
  )
}

export function CallScreen({
  chatId,
  kind,
  title,
  members,
  onClose,
}: {
  chatId: string
  kind: "circle" | "dm"
  title: string
  members: Member[]
  onClose: () => void
}) {
  const t = useTranslations("Call")
  const [pass, setPass] = useState<Pass | null>(null)
  const [dropped, setDropped] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // One request for the pass per attempt, however often the effect runs (React runs it twice in
  // development). Its answer is kept as long as the screen is open: the chat behind it re-renders
  // all the time, and that must never throw the pass away.
  const asked = useRef(-1)
  const open = useRef(true)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    open.current = true
    return () => {
      open.current = false
    }
  }, [])

  useEffect(() => {
    if (asked.current === attempt) return
    asked.current = attempt
    api<Pass>(`/api/rooms/${chatId}/call`, { json: {} })
      .then((p) => {
        if (open.current) setPass(p)
      })
      .catch((e) => {
        toast(e instanceof Error ? e.message : t("failed"))
        close.current()
      })
  }, [chatId, t, attempt])

  const rejoin = useCallback(() => {
    setDropped(false)
    setPass(null)
    setAttempt((n) => n + 1)
  }, [])

  return (
    <div className="dark fixed inset-0 z-[70] flex flex-col bg-[#07060c] text-white [color-scheme:dark]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(50% 40% at 30% 20%, color-mix(in oklab, var(--color-aura-1) 30%, transparent), transparent 70%), radial-gradient(45% 40% at 75% 80%, color-mix(in oklab, var(--color-aura-2) 26%, transparent), transparent 70%)",
        }}
      />
      <header className="relative flex flex-col items-center gap-1 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <span className="text-[12px] font-bold tracking-[0.08em] text-white/55 uppercase">
          {t("kicker")}
        </span>
        <h2 className="font-heading text-[18px]">{title}</h2>
      </header>
      <div className="relative flex-1">
        {dropped ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <p className="text-[15px] text-white/75">{t("dropped")}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={rejoin}
                className="h-11 rounded-pill bg-white px-5 font-heading text-[14px] text-black"
              >
                {t("rejoin")}
              </button>
              <button
                type="button"
                onClick={() => {
                  leave(chatId)
                  onClose()
                }}
                className="h-11 rounded-pill bg-white/12 px-5 text-[14px] font-semibold"
              >
                {t("close")}
              </button>
            </div>
          </div>
        ) : pass ? (
          <LiveKitRoom
            key={attempt}
            serverUrl={pass.url}
            token={pass.token}
            connect
            audio
            video={false}
            onError={() => setDropped(true)}
            onDisconnected={(reason) => {
              if (CLOSING.has(reason)) onClose()
              else setDropped(true)
            }}
            className="h-full"
          >
            <Room
              chatId={chatId}
              kind={kind}
              title={title}
              members={members}
              najimiAsked={pass.call.najimi}
              onLeave={onClose}
            />
            <RoomAudioRenderer />
            <StartAudio
              label={t("tapToHear")}
              className="absolute inset-x-6 top-4 mx-auto h-11 max-w-xs rounded-pill bg-white font-heading text-[14px] text-black"
            />
          </LiveKitRoom>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="size-8 animate-spin text-white/60" />
            <span className="text-[13px] text-white/60">{t("connecting")}</span>
          </div>
        )}
      </div>
    </div>
  )
}
