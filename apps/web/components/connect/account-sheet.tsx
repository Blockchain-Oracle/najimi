"use client"

import type { ConnectionView } from "@najimi/connectors/sessions"
import { SheetTitle } from "@najimi/ui/components/sheet"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { X as Failed, Loader2, LockKeyhole, Plug, UserPlus } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { BrandIcon } from "@/components/brands/brand-icon"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { type Live, platformOf, zone } from "./platforms"
import { SocialRead } from "./social-read"
import type { SocialAction } from "./use-feeds"

/*
 * One connected account: connect it with your own session (two cookies for X, one for Instagram,
 * sealed the moment they arrive), then read what you follow, see what Najimi did, or forget it.
 */

function ConnectForm({ platform, onConnected }: { platform: Live; onConnected: () => void }) {
  const t = useTranslations("Connect")
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [withKey, setWithKey] = useState(false)
  const name = platformOf(platform).name
  const inputs = platform === "x" ? (withKey ? ["key"] : ["authToken", "ct0"]) : ["sessionid"]
  const ready = inputs.every((i) => fields[i]?.trim())

  const submit = async () => {
    setBusy(true)
    try {
      await api(`/api/socials/${platform}`, { json: { ...fields, tz: zone() } })
      sound("promote")
      toast(t("connectedToast", { name }))
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
        {[1, 2].map((n) => (
          <li key={n} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[12px] font-bold">
              {n}
            </span>
            {t(`connectHow.${platform}.${n}` as "connectHow.x.1")}
          </li>
        ))}
      </ol>
      {inputs.map((id) => (
        <input
          key={id}
          aria-label={id === "key" ? t("xKey") : id}
          placeholder={id === "key" ? t("xKey") : id}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={fields[id] ?? ""}
          onChange={(e) => setFields((f) => ({ ...f, [id]: e.target.value }))}
          className="h-12 rounded-tile bg-card px-4 font-mono text-[14px] outline-none ring-1 ring-border placeholder:text-text-3 focus:ring-2 focus:ring-ring"
        />
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
      <p className="flex items-center gap-2 text-[12px] text-text-3">
        <LockKeyhole className="size-3.5 shrink-0" />
        {t("sessionPrivacy")}
      </p>
      <button
        type="submit"
        disabled={!ready || busy}
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-primary font-heading text-[15px] text-primary-foreground disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Plug className="size-5" />}
        {t("connectIt", { name })}
      </button>
    </form>
  )
}

function Did({ actions }: { actions: SocialAction[] }) {
  const t = useTranslations("Connect")
  const format = useFormatter()
  const now = new Date()
  if (!actions.length) return null
  return (
    <section className="flex flex-col">
      <h3 className="mb-1 text-[12px] font-bold tracking-[0.06em] text-text-3 uppercase">
        {t("activityTitle")}
      </h3>
      <ul className="flex flex-col divide-y divide-border">
        {actions.slice(0, 8).map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-tile",
                a.status === "done" ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
              )}
            >
              {a.status === "done" ? (
                <UserPlus className="size-4" />
              ) : (
                <Failed className="size-4" />
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[14px] font-semibold hover:underline"
                >
                  {a.label ?? a.target}
                </a>
              ) : (
                <span className="truncate text-[14px] font-semibold">{a.label ?? a.target}</span>
              )}
              <span className="truncate text-[12px] text-text-3">
                {a.status === "done" ? `@${a.target}` : a.detail}
              </span>
            </span>
            <time
              dateTime={a.createdAt}
              className="shrink-0 text-[11px] text-text-3"
              suppressHydrationWarning
            >
              {format.relativeTime(new Date(Math.min(Date.parse(a.createdAt), now.getTime())), now)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AccountSheet({
  platform,
  connection,
  actions,
  personId,
  onClose,
}: {
  platform: Live
  connection: ConnectionView | null
  actions: SocialAction[]
  personId: string
  onClose: () => void
}) {
  const t = useTranslations("Connect")
  const queryClient = useQueryClient()
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const p = platformOf(platform)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["socials"] })
  const active = connection?.status === "active"

  const forget = async () => {
    setBusy(true)
    try {
      await api(`/api/socials/${platform}`, { method: "DELETE" })
      toast(t("disconnected", { name: p.name }))
      await refresh()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 pt-5">
      <SheetTitle className="flex items-center gap-2 font-title text-[1.6rem] font-normal">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white">
          <BrandIcon icon={p.icon} colored className="size-5" />
        </span>{" "}
        {p.name}
      </SheetTitle>
      {connection ? (
        <div className="flex items-center gap-3">
          {connection.image ? (
            // biome-ignore lint/performance/noImgElement: platform avatar
            <img src={connection.image} alt="" className="size-11 rounded-full object-cover" />
          ) : (
            <span className="size-11 rounded-full bg-secondary" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-heading text-[15px]">
              {connection.name ?? connection.handle}
            </span>
            <span className="truncate text-[13px] text-text-3">@{connection.handle}</span>
          </span>
          <span
            className={cn(
              "rounded-pill px-2.5 py-1 text-[11px] font-bold",
              active ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
            )}
          >
            {active ? t("connected") : t("reconnect")}
          </span>
        </div>
      ) : null}
      {connection?.lastError && !active ? (
        <p className="text-[13px] text-danger">{connection.lastError}</p>
      ) : null}

      {!active ? (
        <ConnectForm platform={platform} onConnected={() => void refresh()} />
      ) : reading ? (
        <SocialRead platform={platform} personId={personId} onDone={onClose} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setReading(true)}
            className="flex h-12 items-center justify-center rounded-pill bg-primary font-heading text-[15px] text-primary-foreground"
          >
            {t("readMine")}
          </button>
          <Did actions={actions.filter((a) => a.platform === platform && a.kind === "follow")} />
          <p className="text-[12px] text-text-3">{t("riskLine", { name: p.name })}</p>
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
    </div>
  )
}
