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
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import type { Participant } from "livekit-client"
import { Loader2, Mic, MicOff, PhoneOff, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

/*
 * A call in a circle or DM, full screen and dark: everyone's face with a ring while they speak,
 * Najimi as its orb once it's brought in (it listens, and answers when someone says its name;
 * what it finds lands in the chat), and three round controls: mute, bring Najimi, leave.
 */

type Member = { userId: string; name: string; look: string | null }
type Pass = { token: string; url: string; call: { id: string; najimi: boolean } }

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

function Room({
  chatId,
  members,
  najimiAsked,
  onLeave,
}: {
  chatId: string
  members: Member[]
  najimiAsked: boolean
  onLeave: () => void
}) {
  const t = useTranslations("Call")
  const room = useRoomContext()
  const people = useParticipants()
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant()
  const [asking, setAsking] = useState(false)
  const [asked, setAsked] = useState(najimiAsked)
  const najimiHere = people.some((p) => p.isAgent)
  const byId = new Map(members.map((m) => [m.userId, m]))

  const bring = async () => {
    setAsking(true)
    try {
      await api(`/api/rooms/${chatId}/call/najimi`, { json: {} })
      setAsked(true)
      sound("promote")
    } catch (e) {
      toast(e instanceof Error ? e.message : t("failed"))
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="grid flex-1 content-center justify-items-center gap-x-6 gap-y-10 px-6 [grid-template-columns:repeat(auto-fit,minmax(7rem,1fr))]">
        {people.map((p) => (
          <Tile key={p.identity} participant={p} member={byId.get(p.identity)} />
        ))}
      </ul>
      <p className="px-6 pb-4 text-center text-[13px] text-white/60">
        {najimiHere
          ? t("sayName")
          : asked
            ? t("najimiComing")
            : t("alone", { count: people.length })}
      </p>
      <div className="flex items-center justify-center gap-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-label={isMicrophoneEnabled ? t("mute") : t("unmute")}
          title={isMicrophoneEnabled ? t("mute") : t("unmute")}
          onClick={() => void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
          className={cn(
            "grid size-16 place-items-center rounded-full transition-colors",
            isMicrophoneEnabled ? "bg-white/12" : "bg-white text-black",
          )}
        >
          {isMicrophoneEnabled ? <Mic className="size-6" /> : <MicOff className="size-6" />}
        </button>
        {najimiHere || asked ? null : (
          <button
            type="button"
            onClick={() => void bring()}
            disabled={asking}
            className="flex h-16 items-center gap-2 rounded-full bg-white px-6 font-heading text-[15px] text-black disabled:opacity-60"
          >
            {asking ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            {t("bring")}
          </button>
        )}
        <button
          type="button"
          aria-label={t("leave")}
          title={t("leave")}
          onClick={() => {
            void room.disconnect()
            onLeave()
          }}
          className="grid size-16 place-items-center rounded-full bg-destructive text-white"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  )
}

export function CallScreen({
  chatId,
  title,
  members,
  onClose,
}: {
  chatId: string
  title: string
  members: Member[]
  onClose: () => void
}) {
  const t = useTranslations("Call")
  const [pass, setPass] = useState<Pass | null>(null)
  // One request for the pass, however often the effect runs (React runs it twice in development).
  const asked = useRef(false)

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    let live = true
    api<Pass>(`/api/rooms/${chatId}/call`, { json: {} })
      .then((p) => {
        if (live) setPass(p)
      })
      .catch((e) => {
        toast(e instanceof Error ? e.message : t("failed"))
        onClose()
      })
    return () => {
      live = false
    }
  }, [chatId, onClose, t])

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
        {pass ? (
          <LiveKitRoom
            serverUrl={pass.url}
            token={pass.token}
            connect
            audio
            video={false}
            onDisconnected={onClose}
            className="h-full"
          >
            <Room
              chatId={chatId}
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
          <div className="grid h-full place-items-center">
            <Loader2 className="size-8 animate-spin text-white/60" />
          </div>
        )}
      </div>
    </div>
  )
}
