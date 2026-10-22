"use client"

import { cn } from "@najimi/ui/lib/utils"
import { Mic, Square } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

const MAX_SECONDS = 60

/** Tap to talk, tap to stop: the words land in the composer to read before sending. */
export function VoiceButton({
  onText,
  onError,
}: {
  onText: (text: string) => void
  onError: (message: string) => void
}) {
  const t = useTranslations("Chat")
  const locale = useLocale()
  const [state, setState] = useState<"idle" | "recording" | "working">("idle")
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current)
      for (const track of recorder.current?.stream.getTracks() ?? []) track.stop()
    },
    [],
  )

  async function start() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError(t("micBlocked"))
      return
    }
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((m) =>
      MediaRecorder.isTypeSupported(m),
    )
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    rec.onstop = async () => {
      for (const track of stream.getTracks()) track.stop()
      if (timer.current) clearInterval(timer.current)
      setState("working")
      const blob = new Blob(chunks, { type: rec.mimeType })
      const form = new FormData()
      form.set(
        "audio",
        new File([blob], rec.mimeType.includes("mp4") ? "voice.mp4" : "voice.webm", {
          type: rec.mimeType,
        }),
      )
      form.set("locale", locale)
      try {
        const response = await fetch("/api/voice", { method: "POST", body: form })
        const body = (await response.json()) as { text?: string; error?: string }
        if (!response.ok) throw new Error(body.error ?? "")
        if (body.text) onText(body.text)
      } catch (e) {
        onError(e instanceof Error && e.message ? e.message : t("voiceFailed"))
      } finally {
        setState("idle")
      }
    }
    recorder.current = rec
    rec.start()
    let elapsed = 0
    setSeconds(0)
    setState("recording")
    timer.current = setInterval(() => {
      elapsed += 1
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS && rec.state === "recording") rec.stop()
    }, 1000)
  }

  const stop = () => recorder.current?.state === "recording" && recorder.current.stop()

  return (
    <button
      type="button"
      onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
      disabled={state === "working"}
      aria-label={state === "recording" ? t("stopRecording") : t("dictate")}
      title={state === "recording" ? t("stopRecording") : t("dictate")}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-sm transition-colors",
        state === "recording"
          ? "bg-sticker px-3 text-white"
          : "text-paper-muted hover:bg-paper-foreground/8 hover:text-paper-foreground",
      )}
    >
      {state === "recording" ? (
        <>
          <span className="size-2 animate-signal-pulse rounded-full bg-signal" />
          <span className="tnum">{`0:${String(seconds).padStart(2, "0")}`}</span>
          <Square className="size-3.5 fill-current" />
        </>
      ) : state === "working" ? (
        <span className="size-2 animate-signal-pulse rounded-full bg-signal" />
      ) : (
        <Mic className="size-5" />
      )}
    </button>
  )
}
