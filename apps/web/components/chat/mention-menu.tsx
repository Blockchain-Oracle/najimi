"use client"

import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { Face } from "@/components/taste/face"

/*
 * Typing "@" in a circle or DM: a short list above the box (Najimi first, then the people in the
 * room) that narrows as you type; arrows or a tap pick one, and its handle goes in the message.
 */

export type Mentionable = {
  id: string
  name: string
  username: string | null
  look: string | null
  najimi?: boolean
}

/** The "@word" being typed right before the caret, if any. */
export function mentionAt(text: string, caret: number) {
  const match = /(?:^|\s)@([\p{L}\p{N}_.]{0,30})$/u.exec(text.slice(0, caret))
  if (!match) return null
  const q = match[1] ?? ""
  return { start: caret - q.length - 1, q: q.toLowerCase() }
}

export function matching(all: Mentionable[], q: string) {
  return all
    .filter(
      (m) => !q || m.name.toLowerCase().includes(q) || m.username?.toLowerCase().startsWith(q),
    )
    .slice(0, 6)
}

/** What a pick puts in the message: Najimi's call sign, or the person's handle (else first name). */
export const tokenOf = (m: Mentionable) =>
  m.najimi ? "@najimi" : `@${m.username ?? m.name.split(" ")[0]}`

export function MentionMenu({
  options,
  active,
  onPick,
  label,
}: {
  options: Mentionable[]
  active: number
  onPick: (m: Mentionable) => void
  label: string
}) {
  return (
    <div
      role="listbox"
      aria-label={label}
      className="absolute bottom-full left-0 z-20 mb-2 w-64 overflow-hidden rounded-card bg-card p-1 shadow-xl ring-1 ring-border"
    >
      {options.map((m, i) => (
        <button
          key={m.id}
          type="button"
          role="option"
          aria-selected={i === active}
          // Picking must not blur the box first (that would close the list before the click lands).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(m)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-tile px-2.5 py-2 text-start transition-colors",
            i === active ? "bg-secondary" : "hover:bg-secondary",
          )}
        >
          {m.najimi ? <Orb size={28} /> : <Face look={m.look} name={m.name} size="sm" />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] font-semibold">{m.name}</span>
            <span className="truncate text-[12px] text-text-3">{tokenOf(m)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
