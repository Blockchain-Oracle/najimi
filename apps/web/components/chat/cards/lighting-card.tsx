"use client"

import type { NajimiTools } from "@najimi/agent"
import { toast } from "@najimi/ui/components/sonner"
import { Copy, Lamp, Lightbulb, Send, Sparkles, Sun } from "lucide-react"
import { useTranslations } from "next-intl"
import { shareChat, useChatId } from "../chat-context"
import { usePublicShare } from "../public-share"
import { CardShell } from "./insights-card"

type Plan = NajimiTools["lightingPlan"]["input"]

/** A colour for a colour temperature: candle amber at 1800 K to daylight blue-white at 6500 K. */
export function kelvinColor(k: number): string {
  const t = Math.min(1, Math.max(0, (k - 1800) / (6500 - 1800)))
  const stops = [
    [255, 147, 41],
    [255, 197, 143],
    [255, 241, 224],
    [201, 226, 255],
  ]
  const at = t * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(at))
  const f = at - i
  const a = stops[i] ?? [255, 255, 255]
  const b = stops[i + 1] ?? [255, 255, 255]
  return `rgb(${a.map((v, j) => Math.round(v + ((b[j] ?? v) - v) * f)).join(",")})`
}

const ICON = { ambient: Sun, task: Lamp, accent: Sparkles, decorative: Lightbulb }

/** The lighting plan (T12, brief #1): layers, moments and a brief an electrician can work from. */
export function LightingCard({ plan, personName }: { plan: Plan; personName: string }) {
  const t = useTranslations("Home")
  const chatId = useChatId()
  const publicView = Boolean(usePublicShare())
  const brief = [
    `${plan.title} — ${plan.room}`,
    ...plan.layers.flatMap((l) =>
      l.fixtures.map(
        (f) =>
          `• ${t(`layers.${l.layer}`)}: ${f.type}, ${f.placement}, ${f.kelvin}K${f.lumens ? `, ${f.lumens} lm` : ""}, ${f.dimmable ? t("dimmable") : t("notDimmable")}, ${t(`controls.${f.control}`)}`,
      ),
    ),
    `${t("circuits")}: ${plan.electrician.circuits}`,
    `${t("switching")}: ${plan.electrician.switching}`,
    `${t("dimmers")}: ${plan.electrician.dimmers}`,
    ...plan.electrician.notes.map((n) => `• ${n}`),
  ].join("\n")
  return (
    <CardShell title={plan.title} callId={null}>
      <p className="text-sm text-paper-muted">
        {t("planFor", { name: personName, room: plan.room })} · {plan.uses.join(" · ")}
      </p>
      <div className="flex flex-wrap gap-2">
        {plan.moments.map((m) => (
          <div
            key={m.name}
            className="flex min-w-36 flex-1 flex-col gap-1 rounded-tile border border-paper-foreground/10 p-2.5"
          >
            <span className="flex items-center gap-2">
              <span
                className="size-4 rounded-full ring-1 ring-black/10"
                style={{ background: kelvinColor(m.kelvin), opacity: 0.4 + m.brightness / 170 }}
              />
              <span className="text-sm font-semibold">{m.name}</span>
            </span>
            <span className="text-xs text-paper-muted tnum">
              {m.kelvin}K · {m.brightness}%
            </span>
            <span className="text-xs">{m.note}</span>
          </div>
        ))}
      </div>
      <ol className="flex flex-col gap-3">
        {plan.layers.map((l) => {
          const Icon = ICON[l.layer]
          return (
            <li key={l.layer} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4" /> {t(`layers.${l.layer}`)}
                <span className="font-normal text-paper-muted">— {l.why}</span>
              </p>
              <ul className="flex flex-col gap-1 ps-6">
                {l.fixtures.map((f) => (
                  <li
                    key={`${f.type}-${f.placement}`}
                    className="flex flex-wrap items-center gap-x-2 text-sm"
                  >
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: kelvinColor(f.kelvin) }}
                    />
                    <span className="font-medium">{f.type}</span>
                    <span className="text-paper-muted">{f.placement}</span>
                    <span className="text-xs text-paper-muted tnum">
                      {f.kelvin}K{f.lumens ? ` · ${f.lumens} lm` : ""} ·{" "}
                      {f.dimmable ? t("dimmable") : t("notDimmable")} · {t(`controls.${f.control}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
      <section className="flex flex-col gap-2 rounded-tile bg-sticker p-3.5 text-sticker-foreground">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-wide text-lime uppercase">
            {t("forElectrician")}
          </p>
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(brief).then(() => toast(t("copied")))}
              className="inline-flex items-center gap-1 rounded-pill bg-white/10 px-2.5 py-1 text-xs font-semibold"
            >
              <Copy className="size-3.5" /> {t("copyBrief")}
            </button>
            {chatId && !publicView ? (
              <button
                type="button"
                onClick={() => void shareChat(chatId, t("linkCopied"))}
                className="inline-flex items-center gap-1 rounded-pill bg-lime px-2.5 py-1 text-xs font-semibold text-lime-foreground"
              >
                <Send className="size-3.5" /> {t("sendElectrician")}
              </button>
            ) : null}
          </span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-white/55">{t("circuits")}</dt>
          <dd>{plan.electrician.circuits}</dd>
          <dt className="text-white/55">{t("switching")}</dt>
          <dd>{plan.electrician.switching}</dd>
          <dt className="text-white/55">{t("dimmers")}</dt>
          <dd>{plan.electrician.dimmers}</dd>
        </dl>
        {plan.electrician.notes.length ? (
          <ul className="list-disc ps-5 text-sm text-white/85">
            {plan.electrician.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </CardShell>
  )
}
