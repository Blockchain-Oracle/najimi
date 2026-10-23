import type { CSSProperties, ReactNode } from "react"

/*
 * Diagrams as plain HTML (no diagram library in the bundle): they read as lists to screen readers,
 * stack on a phone, and take the frame's tokens in light and dark. The step the diagram is about
 * carries the agent's aura, the only colour in the chrome.
 */

type FlowStep = { title: string; note?: string; mono?: string; accent?: boolean }

/** The highlighted step: a hairline in the agent's aura round the card (an inline style, since
 *  two layered backgrounds don't fit in a utility class). */
const AURA_RING: CSSProperties = {
  border: "1px solid transparent",
  background:
    "linear-gradient(var(--color-fd-card), var(--color-fd-card)) padding-box, linear-gradient(120deg, var(--aura-1), var(--aura-2), var(--aura-3)) border-box",
}
const PLAIN = "border border-fd-border bg-fd-card"

/** Boxes in order with arrows between, each with an optional note and a mono line. */
export function Flow({ steps, label }: { steps: FlowStep[]; label: string }) {
  return (
    <figure className="not-prose @container my-8">
      <ol aria-label={label} className="flex flex-col gap-2 @3xl:flex-row @3xl:items-stretch">
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex flex-col gap-2 @3xl:flex-1 @3xl:flex-row @3xl:items-center"
          >
            <div
              className={`flex h-full flex-1 flex-col gap-1 rounded-[16px] p-4 ${s.accent ? "" : PLAIN}`}
              style={s.accent ? AURA_RING : undefined}
            >
              <span className="font-mono text-[10.5px] text-fd-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="font-display text-[15px] leading-tight font-bold">{s.title}</p>
              {s.note ? (
                <p className="text-[13px] leading-snug text-fd-muted-foreground">{s.note}</p>
              ) : null}
              {s.mono ? (
                <p className="mt-auto pt-2 font-mono text-[11px] leading-4 text-fd-muted-foreground">
                  {s.mono}
                </p>
              ) : null}
            </div>
            {i < steps.length - 1 ? (
              <span aria-hidden className="self-center text-fd-muted-foreground">
                <span className="@3xl:hidden">↓</span>
                <span className="hidden @3xl:inline">→</span>
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 text-[12.5px] text-fd-muted-foreground">{label}</figcaption>
    </figure>
  )
}

/** Layers stacked top to bottom (a system diagram): each row a layer, its parts side by side. */
export function Layers({
  rows,
  label,
}: {
  rows: { name: string; parts: string[]; accent?: boolean }[]
  label: string
}) {
  return (
    <figure className="not-prose @container my-8 flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.name}
          className={`grid gap-3 rounded-[16px] p-4 @xl:grid-cols-[9rem_1fr] @xl:items-center ${r.accent ? "" : PLAIN}`}
          style={r.accent ? AURA_RING : undefined}
        >
          <p className="font-display text-[14px] font-bold">{r.name}</p>
          <ul className="flex flex-wrap gap-1.5">
            {r.parts.map((p) => (
              <li
                key={p}
                className="rounded-full border border-fd-border bg-fd-background px-2.5 py-1 text-[12.5px] leading-none"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <figcaption className="text-[12.5px] text-fd-muted-foreground">{label}</figcaption>
    </figure>
  )
}

/** A few big numbers in a row (counts read from the code, never estimates). */
export function Stats({ items }: { items: { value: string; label: ReactNode }[] }) {
  return (
    <dl className="not-prose my-8 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-fd-border bg-fd-border sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.value + String(s.label)} className="flex flex-col gap-1 bg-fd-card p-4">
          <dt className="order-2 text-[12.5px] leading-snug text-fd-muted-foreground">{s.label}</dt>
          <dd className="order-1 font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.02em]">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
