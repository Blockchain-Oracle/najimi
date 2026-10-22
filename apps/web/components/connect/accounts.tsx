"use client"

import type { ConnectionView } from "@najimi/connectors/sessions"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, Loader2, LockKeyhole, Plug, ShieldCheck } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { BRING_EVENT } from "./bring-taste"
import { SocialRead } from "./social-read"

/*
 * Your accounts (W14, W15): X and Instagram connect with your own session so Najimi can read what
 * you follow and, when you say so, follow for you ("Do it for me"); TikTok and YouTube come in
 * from your exports and the tune-up opens them for you. One row each, after 21st.dev
 * shadcnui-blocks/integrations-02 (connected pill, connect button) and SeatGeek's connect step
 * (Refero 9cca4ae4).
 */

export type SocialAction = {
  id: string
  platform: "x" | "instagram" | "tiktok" | "youtube"
  kind: string
  target: string
  label: string | null
  status: "done" | "failed" | "skipped"
  detail: string | null
  url: string | null
  createdAt: string
}
export type Socials = {
  ready: { x: boolean; instagram: boolean }
  connections: ConnectionView[]
  actions: SocialAction[]
  after: number
}

/** Opens an account's sheet from elsewhere on the page (the tune-up's "Do it for me"). */
export const CONNECT_EVENT = "najimi:connect"
export const tz = () =>
  typeof window === "undefined" ? "UTC" : Intl.DateTimeFormat().resolvedOptions().timeZone

export function useSocials() {
  return useQuery({
    queryKey: ["socials"],
    queryFn: () => api<Socials>("/api/socials"),
    staleTime: 60_000,
  })
}

const ROWS = [
  { id: "x", icon: siX, name: "X", kind: "session" },
  { id: "instagram", icon: siInstagram, name: "Instagram", kind: "session" },
  { id: "tiktok", icon: siTiktok, name: "TikTok", kind: "export" },
  { id: "youtube", icon: siYoutube, name: "YouTube", kind: "export" },
] as const
type Live = "x" | "instagram"

function ConnectForm({ platform, onConnected }: { platform: Live; onConnected: () => void }) {
  const t = useTranslations("Connect")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [withKey, setWithKey] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }))
  const inputs =
    platform === "x"
      ? withKey
        ? [{ id: "key", label: t("xKey") }]
        : [
            { id: "authToken", label: "auth_token" },
            { id: "ct0", label: "ct0" },
          ]
      : [{ id: "sessionid", label: "sessionid" }]
  const ready = inputs.every((i) => fields[i.id]?.trim())

  const submit = async () => {
    setBusy(true)
    try {
      await api(`/api/socials/${platform}`, { json: { ...fields, tz: tz() } })
      sound("promote")
      toast(t("connectedToast", { name: platform === "x" ? "X" : "Instagram" }))
      onConnected()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) void submit()
      }}
    >
      <ol className="flex flex-col gap-2 text-[14px] text-text-2">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
              {n}
            </span>
            {t(`connectHow.${platform}.${n}` as "connectHow.x.1")}
          </li>
        ))}
      </ol>
      {inputs.map((i) => (
        <label key={i.id} className="flex flex-col gap-1.5">
          <span className="font-mono text-[12px] text-text-3">{i.label}</span>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={fields[i.id] ?? ""}
            onChange={set(i.id)}
            className="h-12 rounded-tile bg-card px-4 font-mono text-[14px] outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
          />
        </label>
      ))}
      {platform === "x" ? (
        <button
          type="button"
          onClick={() => setWithKey((k) => !k)}
          className="self-start text-[13px] text-text-3 underline underline-offset-4"
        >
          {withKey ? t("xCookiesInstead") : t("xKeyInstead")}
        </button>
      ) : null}
      <p className="flex gap-2 rounded-tile bg-white/5 p-3 text-[12px] leading-relaxed text-text-3">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" />
        {t("sessionPrivacy")}
      </p>
      <button
        type="submit"
        disabled={!ready || busy}
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Plug className="size-5" />}
        {t("connectIt", { name: platform === "x" ? "X" : "Instagram" })}
      </button>
    </form>
  )
}

function AccountSheet({
  platform,
  connection,
  personId,
  onClose,
}: {
  platform: Live
  connection: ConnectionView | null
  personId: string
  onClose: () => void
}) {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const name = platform === "x" ? "X" : "Instagram"
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["socials"] })

  const autopilot = async (on: boolean) => {
    setBusy(true)
    try {
      await api(`/api/socials/${platform}`, { method: "PATCH", json: { autopilot: on, tz: tz() } })
      sound(on ? "promote" : "tap")
      toast(on ? t("autopilotOn", { name }) : t("autopilotOff", { name }))
      await refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setBusy(false)
    }
  }
  const forget = async () => {
    setBusy(true)
    try {
      await api(`/api/socials/${platform}`, { method: "DELETE" })
      toast(t("disconnected", { name }))
      await refresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pt-5">
      <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
        <BrandIcon icon={platform === "x" ? siX : siInstagram} colored className="size-6" /> {name}
      </SheetTitle>
      {!connection ? (
        <ConnectForm platform={platform} onConnected={() => void refresh()} />
      ) : reading ? (
        <SocialRead platform={platform} personId={personId} onDone={onClose} />
      ) : (
        <>
          <div className="flex items-center gap-3">
            {connection.image ? (
              // biome-ignore lint/performance/noImgElement: platform avatar
              <img src={connection.image} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <span className="size-12 rounded-full bg-secondary" />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-heading text-[16px]">
                {connection.name ?? connection.handle}
              </span>
              <span className="truncate text-[13px] text-text-3">@{connection.handle}</span>
            </div>
            <span
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11px] font-bold",
                connection.status === "active"
                  ? "bg-success/15 text-success"
                  : "bg-danger/15 text-danger",
              )}
            >
              {connection.status === "active" ? t("connected") : t("reconnect")}
            </span>
          </div>
          {connection.lastError ? (
            <p className="text-[13px] text-danger">{connection.lastError}</p>
          ) : null}
          {connection.status !== "active" ? (
            <ConnectForm platform={platform} onConnected={() => void refresh()} />
          ) : (
            <>
              <button
                type="button"
                onClick={() => setReading(true)}
                className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground"
              >
                {t("readMine", { name })}
              </button>
              <div className="flex items-start gap-3 rounded-tile bg-white/5 p-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span id={`autopilot-${platform}`} className="font-heading text-[15px]">
                    {t("doItForMe")}
                  </span>
                  <span className="text-[13px] text-text-3">
                    {t(`autopilotLine.${platform}` as "autopilotLine.x")}
                  </span>
                  {connection.pausedUntil ? (
                    <span className="text-[12px] text-warn">{t("pausedUntil")}</span>
                  ) : null}
                </span>
                <Switch
                  aria-labelledby={`autopilot-${platform}`}
                  checked={connection.autopilot}
                  disabled={busy}
                  onCheckedChange={(on) => void autopilot(on)}
                  className="mt-1"
                />
              </div>
              <p className="flex gap-2 text-[12px] leading-relaxed text-text-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                {t("riskLine", { name })}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void forget()}
                className="self-start text-[13px] text-danger underline underline-offset-4"
              >
                {t("disconnect")}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function Accounts({ personId }: { personId: string }) {
  const t = useTranslations("Connect")
  const socials = useSocials()
  const [open, setOpen] = useState<Live | null>(null)
  const connection = (p: string) => socials.data?.connections.find((c) => c.platform === p) ?? null

  // The tune-up's "Do it for me" opens the account here when it isn't connected yet.
  useEffect(() => {
    const onConnect = (e: Event) => setOpen((e as CustomEvent<Live>).detail)
    window.addEventListener(CONNECT_EVENT, onConnect)
    return () => window.removeEventListener(CONNECT_EVENT, onConnect)
  }, [])

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="font-heading text-[17px]">{t("accountsTitle")}</h2>
        <span className="text-[13px] text-text-3">{t("accountsLine")}</span>
      </header>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
        {ROWS.map((row) => {
          const c = connection(row.id)
          const live = row.kind === "session"
          const ready = live ? socials.data?.ready[row.id as Live] !== false : true
          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white">
                <BrandIcon icon={row.icon} colored className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{row.name}</span>
                  {c?.autopilot && c.status === "active" ? (
                    <span className="rounded-pill bg-signal/15 px-2 py-0.5 text-[10px] font-bold text-signal uppercase">
                      {t("autopilotTag")}
                    </span>
                  ) : null}
                </span>
                <span className="truncate text-[12px] text-text-3">
                  {c
                    ? c.status === "active"
                      ? `@${c.handle}`
                      : t("needsReconnect")
                    : t(`rowLine.${row.id}` as "rowLine.x")}
                </span>
              </span>
              {live ? (
                c ? (
                  <button
                    type="button"
                    onClick={() => setOpen(row.id as Live)}
                    className={cn(
                      "rounded-pill px-3 py-1.5 text-[12px] font-bold",
                      c.status === "active"
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger",
                    )}
                  >
                    {c.status === "active" ? t("connected") : t("reconnect")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      sound("tap")
                      setOpen(row.id as Live)
                    }}
                    className="flex items-center gap-1 rounded-pill bg-foreground px-3.5 py-1.5 text-[13px] font-semibold text-background disabled:opacity-40"
                  >
                    {t("connect")} <ArrowUpRight className="size-3.5" />
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent(BRING_EVENT, { detail: row.id }))
                  }
                  className="flex items-center gap-1 rounded-pill bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold"
                >
                  {t("bringExport")}
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[88svh] overflow-y-auto rounded-t-sheet border-0 bg-background px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          {open ? (
            <AccountSheet
              key={open}
              platform={open}
              connection={connection(open)}
              personId={personId}
              onClose={() => setOpen(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
