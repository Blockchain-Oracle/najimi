"use client"

import type { NajimiTools } from "@najimi/agent"
import { cn } from "@najimi/ui/lib/utils"
import { ExternalLink, Loader2, Send } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { siX } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { useSocials } from "@/components/connect/use-feeds"

/*
 * A post Najimi wrote for someone on X: the exact words as they'll appear, from the account
 * they'll go out from, and a yes or no. Once decided, where it went (or a one-tap link to post it
 * by hand). Shaped like a post so there's no guessing what "Post it" does.
 */

type Input = Partial<NajimiTools["postToX"]["input"]>
type Output = NajimiTools["postToX"]["output"]
const LIMIT = 280

function Preview({ text, handle }: { text: string; handle: string | null }) {
  const t = useTranslations("Cards")
  const left = LIMIT - text.length
  return (
    <div className="flex gap-3 rounded-tile bg-white/5 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-black">
        <BrandIcon icon={siX} className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[13px] font-semibold">{handle ? `@${handle}` : t("postYou")}</span>
        <p className="text-[15px] leading-snug whitespace-pre-wrap">{text}</p>
        <span
          className={cn(
            "self-end text-[11px] tabular-nums",
            left < 20 ? "text-warn" : "text-text-3",
          )}
        >
          {left}
        </span>
      </div>
    </div>
  )
}

export function PostApproval({
  input,
  onDecide,
}: {
  input: Input
  onDecide?: (approved: boolean) => void
}) {
  const t = useTranslations("Cards")
  const socials = useSocials()
  const x = socials.data?.connections.find((c) => c.platform === "x" && c.status === "active")
  const [deciding, setDeciding] = useState<boolean | null>(null)
  return (
    <section className="dark flex flex-col gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <span className="text-[11px] font-bold tracking-[0.08em] text-signal uppercase">
        {t("postTitle")}
      </span>
      <Preview text={input.text ?? ""} handle={x?.handle ?? null} />
      <p className="text-[12px] text-text-3">{x ? t("postFromYours") : t("postByLink")}</p>
      {onDecide ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={deciding !== null}
            onClick={() => {
              setDeciding(false)
              onDecide(false)
            }}
            className="glass flex h-11 items-center justify-center rounded-pill text-[14px] font-semibold"
          >
            {t("postNo")}
          </button>
          <button
            type="button"
            disabled={deciding !== null}
            onClick={() => {
              setDeciding(true)
              onDecide(true)
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-pill bg-foreground text-[14px] font-semibold text-background"
          >
            {deciding ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {x ? t("postYes") : t("postReady")}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function PostCard({ input, output }: { input: Input; output: Output }) {
  const t = useTranslations("Cards")
  return (
    <section className="dark flex flex-col gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <span
        className={cn(
          "text-[11px] font-bold tracking-[0.08em] uppercase",
          output.status === "posted" ? "text-success" : "text-signal",
        )}
      >
        {output.status === "posted" ? t("postPosted") : t("postTitle")}
      </span>
      <Preview text={input.text ?? ""} handle={output.handle} />
      {output.note ? <p className="text-[12px] text-danger">{output.note}</p> : null}
      {output.url ? (
        <a
          href={output.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-pill bg-foreground text-[14px] font-semibold text-background"
        >
          {output.status === "posted" ? t("postOpen") : t("postOnX")}
          <ExternalLink className="size-4" />
        </a>
      ) : null}
    </section>
  )
}
