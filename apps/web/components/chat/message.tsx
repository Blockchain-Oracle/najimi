"use client"

import type { NajimiTools, NajimiUIMessage } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { useTranslations } from "next-intl"
import { Streamdown } from "streamdown"
import { CardBoundary } from "./card-boundary"
import { ApprovalCard } from "./cards/approval-card"
import { BriefCard } from "./cards/brief-card"
import { CompareCard } from "./cards/compare-card"
import { CardSkeleton, InsightsCard } from "./cards/insights-card"
import { LightingCard } from "./cards/lighting-card"
import { MealPlanCard } from "./cards/meal-plan-card"
import { ImageCard, VideoCard } from "./cards/media-card"
import { MedicationCard } from "./cards/medication-card"
import { ProductsCard } from "./cards/products-card"
import { RecipeCard } from "./cards/recipe-card"
import { WizardCard } from "./cards/wizard-card"
import { StepChip } from "./lookup-step"
import { usePublicShare } from "./public-share"
import { TextShimmer } from "./text-shimmer"

type Part = NajimiUIMessage["parts"][number]

export type MessageActions = {
  onAsk: (text: string) => void
  onAnswer: (toolCallId: string, output: NajimiTools["askUser"]["output"]) => void
  onApprove: (approvalId: string, approved: boolean) => void
  /** Only the newest message's open cards take answers. */
  live: boolean
}

function ToolPart({ part, actions }: { part: Part; actions: MessageActions }) {
  const t = useTranslations("Cards")
  const shared = usePublicShare() !== null
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
    case "tool-makeImage":
    case "tool-makeVideo": {
      const title = part.input?.title ?? ""
      const words =
        part.type === "tool-makeImage"
          ? (part.input?.words ?? []).filter((w): w is string => Boolean(w))
          : []
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
        return part.type === "tool-makeImage" ? (
          <ImageCard output={part.output} onAsk={actions.onAsk} />
        ) : (
          <VideoCard output={part.output} />
        )
      if (part.state === "output-error") return failed
      return <CardSkeleton title={title} label={t("preparing")} />
    }
    case "tool-lightingPlan":
      if (part.state === "output-available")
        return <LightingCard plan={part.input} personName={part.output.personName} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("planning")} />
    case "tool-findProducts":
      if (part.state === "output-available") return <ProductsCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("shopping")} />
    case "tool-recipe":
      if (part.state === "output-available")
        return (
          <RecipeCard
            recipe={part.input}
            personName={part.output.personName}
            constraints={part.output.constraints}
            onAsk={actions.onAsk}
          />
        )
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("cooking")} />
    case "tool-mealPlan":
      if (part.state === "output-available")
        return <MealPlanCard plan={part.input} personName={part.output.personName} />
      if (part.state === "output-error") return failed
      return <CardSkeleton title={part.input?.title} label={t("cooking")} />
    case "tool-medicationNotes":
      if (part.state === "output-available") return <MedicationCard output={part.output} />
      if (part.state === "output-error") return failed
      return <CardSkeleton label={t("readingLabel")} />
    case "tool-qlooSearch":
      return (
        <StepChip
          kind="search"
          running={part.state !== "output-available"}
          text={t("lookedUp", { q: part.input?.query ?? "…" })}
        />
      )
    case "tool-qlooTags":
      return (
        <StepChip
          kind="tags"
          running={part.state !== "output-available"}
          text={t("lookedUpTags", { q: part.input?.query ?? "…" })}
        />
      )
    case "tool-qlooAudiences":
      return (
        <StepChip
          kind="audiences"
          running={part.state !== "output-available"}
          text={t("lookedUpAudiences")}
        />
      )
    case "tool-savePerson":
      // A stranger reading a shared chat sees that someone was saved, not a link to their page.
      return part.state === "output-available" ? (
        shared ? (
          <StepChip kind="person" text={t("savedPerson", { name: part.output.name })} />
        ) : (
          <a href={`/people/${part.output.personId}`} className="w-fit">
            <StepChip kind="person" text={t("savedPerson", { name: part.output.name })} />
          </a>
        )
      ) : (
        <StepChip
          kind="person"
          running
          text={t("savingPerson", { name: part.input?.name ?? "" })}
        />
      )
    case "tool-remember":
      return part.state === "output-available" ? (
        <StepChip
          kind="remember"
          text={t("remembered", { name: part.output.personName, value: part.output.value })}
        />
      ) : null
    default:
      return null
  }
}

/** One message: the person's words and photos, or Najimi's reply with its cards in order. */
export function Message({
  message,
  actions,
  streaming,
}: {
  message: NajimiUIMessage
  actions: MessageActions
  streaming: boolean
}) {
  const t = useTranslations("Cards")
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
                <img
                  key={p.url}
                  src={p.url}
                  alt=""
                  className="print h-28 w-auto rounded-sm object-cover"
                />
              ) : null,
            )}
          </div>
        ) : null}
        {text ? (
          <p className="sticker max-w-[85%] rounded-[1.25rem] rounded-ee-md px-4 py-2.5 text-[15px] whitespace-pre-wrap">
            {text}
          </p>
        ) : null}
      </div>
    )
  }

  const visible = message.parts.filter((p) => p.type !== "step-start" && p.type !== "reasoning")
  const thinking = streaming && visible.length === 0
  return (
    <div className="flex flex-col gap-3">
      {thinking ? (
        <span className="flex items-center gap-2 text-sm">
          <span className="size-2 animate-signal-pulse rounded-full bg-signal" />
          <TextShimmer>{t("thinking")}</TextShimmer>
        </span>
      ) : null}
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
            <ToolPart part={part} actions={actions} />
          </CardBoundary>
        )
      })}
    </div>
  )
}
