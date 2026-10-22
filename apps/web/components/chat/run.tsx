"use client"

import type { ChatMeta, NajimiUIMessage } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import {
  ChevronDown,
  GitCompareArrows,
  ImageIcon,
  type LucideIcon,
  MessageCircleQuestion,
  Radar,
  ScanFace,
  Search,
  Tags,
  Users,
  X,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useRef, useState } from "react"
import { QlooChip } from "./cards/qloo-chip"
import { TextShimmer } from "./text-shimmer"

/*
 * The run: what Najimi did for this answer, as a visible timeline above it. Every tool call is a
 * step with its own mark, the title the model gave it, and a mono line of what was asked and what
 * came back ("qloo.insights · place · Lagos → 5"). Open while it works, with the step in progress
 * in the signal; folded to one line when it's done ("6 steps · 3 Qloo calls · 14s").
 *
 * After starc007's Agent Activity (21st.dev, beui.dev): the live/summary header, the disclosure
 * that never animates height, the rows that fade in as they stream. Rebuilt on our parts and
 * tokens, with a rail joining the steps (Grok and Perplexity's visible steps).
 */

type Part = NajimiUIMessage["parts"][number]
type StepState = "active" | "done" | "waiting" | "failed"
type Hit = { id: string; name: string; image: string | null }
export type RunStep = {
  id: string
  icon: LucideIcon
  label: string
  meta?: string
  state: StepState
  qloo: boolean
  callId?: string | null
  hits?: Hit[]
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const

function stateOf(part: Part & { state: string }): StepState {
  if (part.state === "output-available" || part.state === "output-denied") return "done"
  if (part.state === "output-error") return "failed"
  if (part.state === "approval-requested") return "waiting"
  if (part.type === "tool-askUser" && part.state === "input-available") return "waiting"
  return "active"
}

const join = (...bits: (string | number | null | undefined | false)[]) =>
  bits.filter((b) => b !== null && b !== undefined && b !== false && b !== "").join(" · ")
const quote = (s: string | undefined) => (s ? `“${s}”` : "…")

/** Every tool call in a message, in order, as a run step. Text parts are the answer, not steps. */
export function useRunSteps(parts: Part[]): RunStep[] {
  const t = useTranslations("Cards")
  const tr = useTranslations("Run")
  const steps: RunStep[] = []
  for (const part of parts) {
    if (!("toolCallId" in part) || !("state" in part)) continue
    const id = part.toolCallId
    const state = stateOf(part as Part & { state: string })
    const done = part.state === "output-available"
    switch (part.type) {
      case "tool-qlooSearch": {
        const found = done ? part.output.found : []
        steps.push({
          id,
          icon: Search,
          label: quote(part.input?.query),
          meta: join("qloo.search", part.input?.types?.join(","), done && `${found.length} found`),
          state,
          qloo: true,
          hits: found.slice(0, 4),
        })
        break
      }
      case "tool-qlooTags": {
        const tags = done ? part.output.tags : []
        steps.push({
          id,
          icon: Tags,
          label: quote(part.input?.query),
          meta: join(
            "qloo.tags",
            done && `${tags.length} tags`,
            tags
              .slice(0, 3)
              .map((x) => x.name)
              .join(", "),
          ),
          state,
          qloo: true,
        })
        break
      }
      case "tool-qlooAudiences":
        steps.push({
          id,
          icon: Users,
          label: t("lookedUpAudiences"),
          meta: join("qloo.audiences", part.input?.kind, done && `${part.output.audiences.length}`),
          state,
          qloo: true,
        })
        break
      case "tool-qlooInsights": {
        const out = done ? part.output : null
        const results = out?.picks?.length ?? out?.tags?.length ?? out?.heatmap?.areas.length
        steps.push({
          id,
          icon: Radar,
          label: out?.title ?? part.input?.title ?? "…",
          meta: join(
            "qloo.insights",
            part.input?.ask,
            ...(out?.asked ?? []).slice(0, 3).map((a) => a.v),
            results !== undefined && `→ ${results}`,
          ),
          state,
          qloo: true,
          callId: out?.callId ?? null,
        })
        break
      }
      case "tool-qlooCompare":
        steps.push({
          id,
          icon: GitCompareArrows,
          label: part.input?.title ?? "…",
          meta: join("qloo.compare", done && `${part.output.shared.length} shared`),
          state,
          qloo: true,
          callId: done ? part.output.callId : null,
        })
        break
      case "tool-tasteBrief":
        steps.push({
          id,
          icon: ScanFace,
          label: tr("readTaste", { name: done ? part.output.personName : "" }),
          meta: done
            ? join(
                `${Object.keys(part.output.words).length} families`,
                `${part.output.loves.length} loves`,
                part.output.focus,
              )
            : undefined,
          state,
          qloo: false,
        })
        break
      case "tool-makeImage": {
        const words = (part.input?.words ?? []).filter(Boolean)
        steps.push({
          id,
          icon: ImageIcon,
          label: part.input?.title ?? "…",
          meta: state === "waiting" ? tr("waiting") : join("image", ...words.slice(0, 3)),
          state,
          qloo: false,
        })
        break
      }
      case "tool-askUser":
        steps.push({
          id,
          icon: MessageCircleQuestion,
          label: part.input?.title ?? tr("askedYou"),
          meta: state === "waiting" ? tr("askedYou") : undefined,
          state,
          qloo: false,
        })
        break
      default:
        break
    }
  }
  return steps
}

function StepRow({ step }: { step: RunStep }) {
  const Icon = step.state === "failed" ? X : step.icon
  const tr = useTranslations("Run")
  return (
    <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5 py-1.5">
      <span
        className={cn(
          "relative z-10 grid size-6 place-items-center rounded-full bg-card ring-1",
          step.state === "active"
            ? "text-signal ring-signal/40"
            : step.state === "failed"
              ? "text-destructive ring-destructive/40"
              : step.state === "waiting"
                ? "text-foreground ring-white/30"
                : "text-text-3 ring-border",
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="flex min-w-0 items-center gap-2">
          {step.state === "active" ? (
            <TextShimmer className="truncate text-sm">{step.label}</TextShimmer>
          ) : (
            <span
              className={cn(
                "truncate text-sm",
                step.state === "waiting" ? "text-foreground" : "text-text-2",
              )}
            >
              {step.label}
            </span>
          )}
          {step.callId ? <QlooChip callId={step.callId} /> : null}
        </span>
        {step.meta || step.state === "failed" ? (
          <span className="font-mono text-[11px] leading-4 break-words text-text-3">
            {step.state === "failed" ? tr("failed") : step.meta}
          </span>
        ) : null}
        {step.hits?.length ? (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {step.hits.map((h) => (
              <span
                key={h.id}
                className="inline-flex max-w-40 items-center gap-1.5 rounded-tag bg-raised py-0.5 ps-0.5 pe-2 text-xs text-text-2 shadow-sticker"
              >
                <span className="size-4 shrink-0 overflow-hidden rounded-[3px] bg-white/5">
                  {h.image ? (
                    // biome-ignore lint/performance/noImgElement: Qloo artwork from its own CDN
                    <img src={h.image} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="truncate">{h.name}</span>
              </span>
            ))}
          </span>
        ) : null}
      </span>
    </li>
  )
}

/** The run above an answer. Renders nothing for a reply that used no tools. */
export function Run({
  parts,
  working,
  meta,
}: {
  parts: Part[]
  working: boolean
  meta?: ChatMeta
}) {
  const t = useTranslations("Cards")
  const tr = useTranslations("Run")
  const steps = useRunSteps(parts)
  const reduce = useReducedMotion() ?? false
  const contentId = useId()
  const [open, setOpen] = useState(false)
  const wasWorking = useRef(working)

  // Folded once the answer is in, unless the person opens it again.
  useEffect(() => {
    if (wasWorking.current && !working) setOpen(false)
    wasWorking.current = working
  }, [working])

  if (!steps.length && !working) return null
  const expanded = working || open
  const live = [...steps].reverse().find((s) => s.state === "active" || s.state === "waiting")
  const calls = steps.filter((s) => s.qloo).length
  const seconds =
    meta?.createdAt && meta.finishedAt
      ? Math.max(1, Math.round((meta.finishedAt - meta.createdAt) / 1000))
      : null

  return (
    <section
      aria-busy={working}
      className="overflow-hidden rounded-card bg-card/70 shadow-paper"
      data-state={working ? "working" : expanded ? "open" : "closed"}
    >
      {working ? (
        <div role="status" className="flex h-10 items-center gap-2.5 px-3.5 text-sm">
          <span className="size-2 shrink-0 animate-signal-pulse rounded-full bg-signal" />
          <TextShimmer className="truncate">{live?.label ?? t("thinking")}</TextShimmer>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
          className="group flex h-10 w-full items-center gap-2.5 px-3.5 text-start text-sm text-text-2 transition-colors hover:text-foreground"
        >
          <span className="size-2 shrink-0 rounded-full bg-text-4" />
          <span className="truncate">
            {tr("summary", { steps: steps.length, calls })}
            {seconds ? <span className="font-mono text-xs text-text-3"> · {seconds}s</span> : null}
          </span>
          <ChevronDown
            className={cn(
              "ms-auto size-4 shrink-0 text-text-3 transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
        </button>
      )}
      <motion.div
        id={contentId}
        initial={false}
        animate={
          reduce
            ? { opacity: expanded ? 1 : 0 }
            : { opacity: expanded ? 1 : 0, y: expanded ? 0 : -4 }
        }
        transition={{ duration: expanded ? 0.22 : 0.14, ease: EASE_OUT }}
        inert={!expanded}
        aria-hidden={!expanded}
        style={{ height: expanded ? "auto" : 0 }}
        className="overflow-hidden"
      >
        {steps.length ? (
          <ol className="relative px-3.5 pt-0.5 pb-3 before:absolute before:start-[1.625rem] before:top-3 before:bottom-5 before:w-px before:bg-border">
            {steps.map((step) => (
              <motion.div
                key={step.id}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <StepRow step={step} />
              </motion.div>
            ))}
          </ol>
        ) : null}
      </motion.div>
    </section>
  )
}
