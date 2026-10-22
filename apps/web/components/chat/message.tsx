"use client"

import type { NajimiTools, NajimiUIMessage } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { Streamdown } from "streamdown"
import { Face } from "@/components/taste/face"
import { CardBoundary } from "./card-boundary"
import { ApprovalCard } from "./cards/approval-card"
import { BriefCard } from "./cards/brief-card"
import { BusinessCard } from "./cards/business-card"
import { CallApproval, CallCard } from "./cards/call-card"
import { CompareCard } from "./cards/compare-card"
import { GameCard } from "./cards/game-card"
import { GroupFitCard } from "./cards/group-fit-card"
import { HotelsCard } from "./cards/hotels-card"
import { CardSkeleton, InsightsCard } from "./cards/insights-card"
import { ImageCard } from "./cards/media-card"
import { PlanCard } from "./cards/plan-card"
import { PostApproval, PostCard } from "./cards/post-card"
import { SteerCard } from "./cards/steer-card"
import { WizardCard } from "./cards/wizard-card"
import { Run } from "./run"

type Part = NajimiUIMessage["parts"][number]

export type MessageActions = {
  onAsk: (text: string) => void
  onAnswer: (toolCallId: string, output: NajimiTools["askUser"]["output"]) => void
  onApprove: (approvalId: string, approved: boolean) => void
  /** Only the newest message's open cards take answers. */
  live: boolean
}

function ToolPart({
  part,
  actions,
  streaming = false,
}: {
  part: Part
  actions: MessageActions
  /** The message is still being written: its cards are new this moment. */
  streaming?: boolean
}) {
  const t = useTranslations("Cards")
  const failed = <p className="text-sm text-text-3">{t("failed")}</p>
  switch (part.type) {
    case "tool-qlooInsights":
      if (part.state === "output-available")
        return <InsightsCard input={part.input} output={part.output} onAsk={actions.onAsk} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("asking")} />
    case "tool-qlooCompare":
      if (part.state === "output-available") return <CompareCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("asking")} />
    case "tool-tasteBrief":
      if (part.state === "output-available") return <BriefCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.ask} label={t("asking")} />
    case "tool-askUser":
      if (part.state === "output-available")
        return <WizardCard input={part.input} output={part.output} />
      if (part.state === "output-error")
        return part.input ? (
          <WizardCard input={part.input} output={{ answers: [], skipped: true }} />
        ) : (
          failed
        )
      if (part.state === "input-available")
        return (
          <WizardCard
            input={part.input}
            onAnswer={
              actions.live ? (output) => actions.onAnswer(part.toolCallId, output) : undefined
            }
          />
        )
      return <CardSkeleton title={part.input?.title} label={t("thinking")} />
    case "tool-makeImage": {
      const title = part.input?.title ?? ""
      const words = (part.input?.words ?? []).filter((w): w is string => Boolean(w))
      if (part.state === "approval-requested")
        return (
          <ApprovalCard
            title={title}
            words={words}
            reason={part.approval.reason}
            onDecide={
              part.approval.isAutomatic || !actions.live
                ? undefined
                : (ok) => actions.onApprove(part.approval.id, ok)
            }
          />
        )
      if (part.state === "output-denied")
        return (
          <p className="rounded-card border border-dashed border-foreground/25 px-4 py-3 text-sm text-text-2">
            {part.approval?.reason === "plan" ? t("planOnly", { title }) : t("declined", { title })}
          </p>
        )
      if (part.state === "output-available")
        return <ImageCard output={part.output} onAsk={actions.onAsk} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={title} label={t("preparing")} />
    }
    case "tool-groupFit":
      if (part.state === "output-available") return <GroupFitCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("asking")} />
    case "tool-planNight":
    case "tool-planTrip":
      if (part.state === "output-available") return <PlanCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={undefined} label={t("planning")} />
    case "tool-findHotels":
      if (part.state === "output-available") return <HotelsCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={undefined} label={t("rooms")} />
    case "tool-callToBook":
      if (part.state === "approval-requested")
        return (
          <CallApproval
            input={part.input ?? {}}
            onDecide={
              part.approval.isAutomatic || !actions.live
                ? undefined
                : (ok) => actions.onApprove(part.approval.id, ok)
            }
          />
        )
      if (part.state === "output-denied")
        return (
          <p className="text-sm text-text-3">
            {t("callDeclined", { venue: part.input?.venue ?? "" })}
          </p>
        )
      if (part.state === "output-available")
        return <CallCard input={part.input ?? {}} output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.venue} label={t("dialling")} />
    case "tool-businessPlan":
      if (part.state === "output-available") return <BusinessCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.name} label={t("businessStarting")} />
    case "tool-postToX":
      if (part.state === "approval-requested")
        return (
          <PostApproval
            input={part.input ?? {}}
            onDecide={
              part.approval.isAutomatic || !actions.live
                ? undefined
                : (ok) => actions.onApprove(part.approval.id, ok)
            }
          />
        )
      if (part.state === "output-denied")
        return <p className="text-sm text-text-3">{t("postDeclined")}</p>
      if (part.state === "output-available")
        return <PostCard input={part.input ?? {}} output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={undefined} label={t("postWriting")} />
    case "tool-startGame":
      if (part.state === "output-available") return <GameCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={undefined} label={t("dealing")} />
    case "tool-steerFeed":
      if (part.state === "output-available")
        return <SteerCard output={part.output} fresh={streaming} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={undefined} label={t("asking")} />
    // Lookups are steps of the run, shown above the reply.
    case "tool-qlooSearch":
    case "tool-qlooTags":
    case "tool-qlooAudiences":
      return null
    default:
      return null
  }
}

/** One message: the person's words and photos, or Najimi's reply with its cards in order. */
export function Message({
  message,
  actions,
  streaming,
  from,
}: {
  message: NajimiUIMessage
  actions: MessageActions
  streaming: boolean
  /** In a room with people: who said it (someone else's messages sit on the left, with their face). */
  from?: { mine: boolean; name: string; look: string | null } | null
}) {
  const t = useTranslations("Cards")
  if (message.role === "system") {
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join(" ")
      .trim()
    return <p className="text-center text-[12px] text-text-3">{text}</p>
  }
  if (message.role === "user" && from && !from.mine) {
    const photos = message.parts.filter((p) => p.type === "file")
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("\n")
      .trim()
    return (
      <div className="flex items-end gap-2">
        <Face look={from.look} name={from.name} size="sm" />
        <div className="flex max-w-[85%] flex-col gap-1">
          <span className="ps-1 text-[12px] font-semibold text-text-3">{from.name}</span>
          {photos.length ? (
            <div className="flex flex-wrap gap-2">
              {photos.map((p) =>
                p.type === "file" ? (
                  // biome-ignore lint/performance/noImgElement: a member-checked photo from the room
                  <img key={p.url} src={p.url} alt="" className="print h-28 w-auto object-cover" />
                ) : null,
              )}
            </div>
          ) : null}
          {text ? (
            <p className="rounded-card rounded-es-[4px] bg-card px-4 py-2.5 text-[15px] whitespace-pre-wrap">
              {text}
            </p>
          ) : null}
        </div>
      </div>
    )
  }
  if (message.role === "user") {
    const photos = message.parts.filter((p) => p.type === "file")
    const text = message.parts
      .map((p) => (p.type === "text" ? p.text : ""))
      .join("\n")
      .trim()
    return (
      <div className="flex flex-col items-end gap-2">
        {photos.length ? (
          <div className="flex flex-wrap justify-end gap-2">
            {photos.map((p) =>
              p.type === "file" ? (
                // biome-ignore lint/performance/noImgElement: a private, session-checked photo
                <img key={p.url} src={p.url} alt="" className="print h-28 w-auto object-cover" />
              ) : null,
            )}
          </div>
        ) : null}
        {text ? (
          <p className="max-w-[85%] rounded-card rounded-ee-[4px] bg-raised px-4 py-2.5 text-[15px] whitespace-pre-wrap shadow-sticker">
            {text}
          </p>
        ) : null}
      </div>
    )
  }

  const visible = message.parts.filter((p) => p.type !== "step-start" && p.type !== "reasoning")
  return (
    <div className="flex flex-col gap-3">
      <Run parts={message.parts} working={streaming} meta={message.metadata} />
      {visible.map((part, i) => {
        const key = "toolCallId" in part ? part.toolCallId : `${message.id}-${i}`
        if (part.type === "text")
          return part.text.trim() ? (
            <div key={key} className={cn("prose-najimi max-w-none text-[15px] leading-relaxed")}>
              <Streamdown>{part.text}</Streamdown>
            </div>
          ) : null
        return (
          <CardBoundary key={key} fallback={<p className="text-sm text-text-3">{t("failed")}</p>}>
            <ToolPart part={part} actions={actions} streaming={streaming} />
          </CardBoundary>
        )
      })}
    </div>
  )
}
