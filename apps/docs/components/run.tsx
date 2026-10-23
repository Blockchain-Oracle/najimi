import {
  BedDouble,
  Building2,
  CalendarCheck,
  Gamepad2,
  GitCompareArrows,
  Globe,
  ImageIcon,
  type LucideIcon,
  MessageCircleQuestion,
  Phone,
  Radar,
  Route,
  ScanFace,
  Search,
  Send,
  SlidersHorizontal,
  Tags,
  Users,
  Vote,
} from "lucide-react"
import type { ReactNode } from "react"
import { Orb } from "./orb"
import { QlooLogo } from "./qloo-logo"

/*
 * One of Najimi's answers as the app shows it (apps/web/components/chat/run.tsx): the question,
 * then every tool call as a step on a rail, with the title the model gave it and a mono line of
 * what was asked and what came back ("qloo.insights · artist · rainy day → 3"), then the answer.
 * The examples in these docs are real runs, copied from the app's own message log.
 */

const ICONS = {
  search: Search,
  tags: Tags,
  insights: Radar,
  compare: GitCompareArrows,
  brief: ScanFace,
  audiences: Users,
  image: ImageIcon,
  ask: MessageCircleQuestion,
  web: Globe,
  night: Route,
  hotels: BedDouble,
  call: Phone,
  post: Send,
  game: Gamepad2,
  poll: Vote,
  steer: SlidersHorizontal,
  business: Building2,
  booked: CalendarCheck,
  group: Users,
} satisfies Record<string, LucideIcon>

export type RunStep = {
  icon: keyof typeof ICONS
  label: string
  meta?: string
  /** A Qloo call: it carries Qloo's mark, like the chip in the app. */
  qloo?: boolean
  /** Waiting for your yes (an approval card in the app). */
  waiting?: boolean
  hits?: { name: string; image: string }[]
}

export function Run({
  ask,
  who = "You",
  room,
  steps,
  summary,
  card,
  children,
}: {
  ask: string
  who?: string
  /** Where it happened, e.g. "Friday crew · a circle". */
  room?: string
  steps: RunStep[]
  summary?: string
  /** A card the answer carried (a plan, hotels, a game), named in one line. */
  card?: ReactNode
  children?: ReactNode
}) {
  const qloo = steps.filter((s) => s.qloo).length
  // The app's own summary line ("5 steps · 5 Qloo calls").
  const line =
    summary ??
    [
      `${steps.length} step${steps.length === 1 ? "" : "s"}`,
      qloo === 0 ? "no Qloo calls" : `${qloo} Qloo call${qloo === 1 ? "" : "s"}`,
    ].join(" · ")
  return (
    <figure className="not-prose my-8 overflow-hidden rounded-[20px] border border-fd-border bg-fd-card">
      {room ? (
        <div className="border-b border-fd-border px-5 py-2.5 font-mono text-[11px] text-fd-muted-foreground">
          {room}
        </div>
      ) : null}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col items-end gap-1">
          <span className="text-[11px] font-medium text-fd-muted-foreground">{who}</span>
          <p className="max-w-[85%] rounded-[18px] rounded-tr-md bg-fd-primary px-4 py-2.5 text-[15px] leading-snug text-fd-primary-foreground">
            {ask}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Orb size={26} />
            <span className="font-display text-[15px] font-bold">Najimi</span>
            {steps.length ? (
              <span className="font-mono text-[11px] text-fd-muted-foreground">{line}</span>
            ) : null}
          </div>
          {steps.length ? (
            <ol className="relative ms-1 flex flex-col">
              <span aria-hidden className="absolute top-3 bottom-3 left-[11px] w-px bg-fd-border" />
              {steps.map((step, i) => {
                const Icon = ICONS[step.icon]
                return (
                  <li
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list, never reordered
                    key={i}
                    className="step-in relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 py-1.5 motion-safe:animate-[step-in_420ms_cubic-bezier(0.16,1,0.3,1)_both]"
                    style={{ animationDelay: `${i * 90}ms` }}
                  >
                    <span
                      className={`relative z-10 grid size-6 place-items-center rounded-full bg-fd-background ring-1 ${
                        step.waiting
                          ? "text-fd-foreground ring-fd-foreground/40"
                          : "text-fd-muted-foreground ring-fd-border"
                      }`}
                    >
                      <Icon className="size-3.5" strokeWidth={1.75} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-1 pt-0.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={`truncate text-sm ${step.waiting ? "font-medium" : "text-fd-foreground/80"}`}
                        >
                          {step.label}
                        </span>
                        {step.qloo ? (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-fd-border px-1.5 py-0.5">
                            <QlooLogo className="h-[0.6rem]" />
                          </span>
                        ) : null}
                      </span>
                      {step.meta ? (
                        <span className="font-mono text-[11px] leading-4 break-words text-fd-muted-foreground">
                          {step.meta}
                        </span>
                      ) : null}
                      {step.hits?.length ? (
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {step.hits.map((h) => (
                            <span
                              key={h.name}
                              className="inline-flex items-center gap-1.5 rounded-full border border-fd-border bg-fd-background py-0.5 ps-0.5 pe-2.5 text-[12px]"
                            >
                              {/* biome-ignore lint/performance/noImgElement: Qloo's own artwork */}
                              <img
                                src={h.image}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="size-5 rounded-full object-cover"
                              />
                              {h.name}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </li>
                )
              })}
            </ol>
          ) : null}
        </div>

        {card ? (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-fd-border bg-fd-background px-3.5 py-2.5">
            <CalendarCheck
              className="size-4 shrink-0 text-fd-muted-foreground"
              strokeWidth={1.75}
            />
            <span className="font-mono text-[11.5px] leading-[1.45] text-fd-muted-foreground">
              {card}
            </span>
          </div>
        ) : null}

        {children ? (
          <div className="prose prose-sm max-w-none border-t border-fd-border pt-4 text-[14.5px] [&_p]:my-2">
            {children}
          </div>
        ) : null}
      </div>
    </figure>
  )
}
