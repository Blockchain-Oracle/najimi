"use client"

import { TASTE } from "@najimi/config"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { GitBranchPlus, Loader2, MessageCircle } from "lucide-react"
import { useTranslations } from "next-intl"
import { useAgent } from "@/components/agent/agent-context"
import { OpenThing } from "@/components/entity/entity-provider"

/*
 * One node of the graph: why it's there (each love's share of it, from Qloo's explainability),
 * how much a love counts (turn it and the graph answers at once), and what to do with it next:
 * grow the graph from here, or ask Najimi about it.
 */

export type GraphNode = {
  id: string
  kind: "me" | "love" | "pick" | "grown"
  name: string
  image: string | null
  type: string
  caption?: string | null
  weight?: number
  loveId?: string
  glow?: boolean
  fade?: number
  look?: string | null
  because?: { name: string; share: number }[]
}

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

export function NodeSheet({
  node,
  onClose,
  mine,
  weight,
  onWeight,
  growing,
  onGrow,
}: {
  node: GraphNode | null
  onClose: () => void
  /** The graph is the viewer's own (weights can move). */
  mine: boolean
  weight: number | null
  onWeight: (weight: number) => void
  growing: boolean
  onGrow: () => void
}) {
  const t = useTranslations("Graph")
  const agent = useAgent()
  const open = Boolean(node && node.kind !== "me")
  const total = node?.because?.reduce((n, b) => n + b.share, 0) || 1
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent
        side="bottom"
        showOverlay={false}
        className="dark max-h-[60svh] overflow-y-auto rounded-t-sheet border-0 bg-[#0d0c12]/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground backdrop-blur-xl md:mx-auto md:max-w-lg"
      >
        {node ? (
          <div className="flex flex-col gap-4 pt-5">
            <div className="flex items-center gap-3">
              {node.image ? (
                <OpenThing
                  thing={{ ...node, qlooId: node.id }}
                  surface="graph"
                  className="shrink-0 rounded-tile"
                >
                  {/* biome-ignore lint/performance/noImgElement: remote artwork */}
                  <img
                    src={sized(node.image, 240) ?? ""}
                    alt=""
                    className="size-16 rounded-tile object-cover ring-1 ring-white/15"
                  />
                </OpenThing>
              ) : null}
              <div className="flex min-w-0 flex-col">
                <span className="text-[11px] font-bold tracking-[0.1em] text-signal uppercase">
                  {node.kind === "love"
                    ? t("aLove")
                    : node.kind === "grown"
                      ? t("grown")
                      : t("aPick")}
                </span>
                <OpenThing thing={{ ...node, qlooId: node.id }} surface="graph" chevron>
                  <SheetTitle className="truncate font-title text-[1.5rem] leading-tight font-normal">
                    {node.name}
                  </SheetTitle>
                </OpenThing>
                {node.caption ? (
                  <span className="truncate text-[13px] text-text-3">{node.caption}</span>
                ) : null}
              </div>
            </div>

            {node.kind === "love" && weight !== null ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-text-2">{t("counts")}</span>
                  <span className="font-title text-[22px] tabular-nums">{weight}</span>
                </div>
                <input
                  type="range"
                  min={TASTE.weightMin}
                  max={TASTE.weightMax}
                  step={1}
                  value={weight}
                  disabled={!mine}
                  onChange={(e) => onWeight(Number(e.target.value))}
                  aria-label={t("counts")}
                  className="w-full accent-[var(--color-signal)]"
                />
                <p className="text-[12px] text-text-3">{mine ? t("countsHint") : t("notYours")}</p>
              </div>
            ) : null}

            {node.because?.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-text-2">{t("because")}</span>
                {node.because.map((b) => (
                  <div key={b.name} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-[13px] font-semibold">
                      {b.name}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-signal"
                        style={{ width: `${Math.round((b.share / total) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 text-end text-[12px] text-text-3 tabular-nums">
                      {Math.round((b.share / total) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onGrow}
                disabled={growing}
                className="flex h-11 items-center justify-center gap-2 rounded-pill bg-foreground text-[14px] font-semibold text-background disabled:opacity-60"
              >
                {growing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GitBranchPlus className="size-4" />
                )}
                {t("grow")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  agent.ask(t("ask", { name: node.name }))
                }}
                className="glass flex h-11 items-center justify-center gap-2 rounded-pill text-[14px] font-semibold"
              >
                <MessageCircle className="size-4" />
                {t("askNajimi")}
              </button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
