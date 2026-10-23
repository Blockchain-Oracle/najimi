"use client"

import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, Share, SquarePlus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { api } from "@/lib/fetcher"
import {
  currentSubscription,
  install,
  installPrompt,
  isIos,
  isStandalone,
  pushSupported,
  subscribe,
  unsubscribe,
} from "@/lib/push-client"
import { sound } from "@/lib/sounds"

/*
 * Notifications (W24): Najimi on the home screen, push on this phone, and which news it brings.
 * On an iPhone, push only works from the Home Screen app, so that comes first there.
 */

type Prefs = { messages: boolean; games: boolean; plans: boolean; feeds: boolean }
const KINDS = ["messages", "games", "plans", "feeds"] as const

export function PushSettings() {
  const t = useTranslations("Settings")
  const queryClient = useQueryClient()
  const push = useQuery({
    queryKey: ["push"],
    queryFn: () => api<{ publicKey: string | null; prefs: Prefs }>("/api/push"),
  })
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [env, setEnv] = useState({ ios: false, standalone: false, supported: true })

  useEffect(() => {
    setEnv({ ios: isIos(), standalone: isStandalone(), supported: pushSupported() })
    setCanInstall(Boolean(installPrompt()))
    const ready = () => setCanInstall(true)
    window.addEventListener("najimi:installable", ready)
    void currentSubscription().then((s) => setOn(Boolean(s)))
    return () => window.removeEventListener("najimi:installable", ready)
  }, [])

  const toggle = async (next: boolean) => {
    if (!push.data?.publicKey) return
    setBusy(true)
    try {
      if (next) {
        const ok = await subscribe(push.data.publicKey)
        if (!ok) toast(t("pushDenied"))
        setOn(ok)
        if (ok) sound("promote")
      } else {
        await unsubscribe()
        setOn(false)
      }
    } finally {
      setBusy(false)
    }
  }
  const setPref = async (key: (typeof KINDS)[number], value: boolean) => {
    if (!push.data) return
    const prefs = { ...push.data.prefs, [key]: value }
    queryClient.setQueryData(["push"], { ...push.data, prefs })
    await api("/api/push", { method: "PATCH", json: prefs }).catch(() =>
      queryClient.invalidateQueries({ queryKey: ["push"] }),
    )
  }

  const needsHome = env.ios && !env.standalone
  return (
    <div className="flex flex-col gap-4">
      {needsHome ? (
        <div className="flex flex-col gap-2 rounded-tile bg-secondary p-4">
          <span className="font-heading text-[15px]">{t("homeTitle")}</span>
          <span className="flex items-center gap-2 text-[14px] text-text-2">
            <Share className="size-4 shrink-0" /> {t("homeStep1")}
          </span>
          <span className="flex items-center gap-2 text-[14px] text-text-2">
            <SquarePlus className="size-4 shrink-0" /> {t("homeStep2")}
          </span>
        </div>
      ) : canInstall && !env.standalone ? (
        <button
          type="button"
          onClick={() => void install().then((ok) => ok && setCanInstall(false))}
          className="flex h-11 items-center justify-center gap-2 rounded-pill bg-primary text-[15px] font-semibold text-primary-foreground"
        >
          <Download className="size-4" /> {t("install")}
        </button>
      ) : null}
      {env.standalone ? null : (
        <Link
          href="/download"
          className="text-[13px] font-semibold text-text-2 underline-offset-4 hover:text-foreground hover:underline focus-visible:underline"
        >
          {t("phoneApp")} →
        </Link>
      )}

      {!env.supported || needsHome ? null : (
        <>
          <div className="flex items-center justify-between gap-3">
            <span id="push-on" className="text-[15px] font-semibold">
              {t("pushOn")}
            </span>
            <Switch
              aria-labelledby="push-on"
              checked={Boolean(on)}
              disabled={busy || on === null || !push.data?.publicKey}
              onCheckedChange={(v) => void toggle(v)}
            />
          </div>
          {on ? (
            <ul className="flex flex-col divide-y divide-border">
              {KINDS.map((k) => (
                <li key={k} className="flex items-center justify-between gap-3 py-2.5">
                  <span id={`push-${k}`} className="text-[14px] text-text-2">
                    {t(`push.${k}`)}
                  </span>
                  <Switch
                    size="sm"
                    aria-labelledby={`push-${k}`}
                    checked={push.data?.prefs[k] ?? true}
                    onCheckedChange={(v) => void setPref(k, v)}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  )
}
