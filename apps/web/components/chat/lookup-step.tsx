"use client"

import { Brain, Search, Tags, UserPlus, Users } from "lucide-react"

const ICONS = { search: Search, tags: Tags, audiences: Users, remember: Brain, person: UserPlus }

/** A small step the agent took on the way (a Qloo lookup, a remembered fact), shown as a chip. */
export function StepChip({
  kind,
  text,
  running,
}: {
  kind: keyof typeof ICONS
  text: string
  running?: boolean
}) {
  const Icon = ICONS[kind]
  return (
    <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-pill border border-foreground/12 px-2.5 py-1 text-xs text-text-2">
      {running ? (
        <span className="size-1.5 animate-signal-pulse rounded-full bg-signal" />
      ) : (
        <Icon className="size-3.5 shrink-0" />
      )}
      <span className="truncate">{text}</span>
    </span>
  )
}
