/**
 * A diagram as plain HTML: boxes in order with arrows between, each with an optional note. Reads
 * as a list to screen readers and stacks on a phone; no diagram library in the bundle.
 */
export function Flow({
  steps,
  label,
}: {
  steps: { title: string; note?: string; accent?: boolean }[]
  label: string
}) {
  return (
    // A container query: the row needs its own column to be wide, whatever the window is.
    <figure className="not-prose @container my-6">
      <ol
        aria-label={label}
        className="flex flex-col items-stretch gap-2 @3xl:flex-row @3xl:items-center"
      >
        {steps.map((s, i) => (
          <li
            key={s.title}
            className="flex flex-col items-stretch gap-2 @3xl:flex-1 @3xl:flex-row @3xl:items-center"
          >
            <div
              className={
                s.accent
                  ? "flex-1 rounded-xl border-2 border-fd-primary bg-fd-primary/10 p-3"
                  : "flex-1 rounded-xl border bg-fd-card p-3"
              }
            >
              <p className="text-sm font-semibold">{s.title}</p>
              {s.note ? <p className="mt-1 text-xs text-fd-muted-foreground">{s.note}</p> : null}
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
      <figcaption className="mt-2 text-xs text-fd-muted-foreground">{label}</figcaption>
    </figure>
  )
}

/** Layers stacked top to bottom (a system diagram): each row a layer, its parts side by side. */
export function Layers({
  rows,
  label,
}: {
  rows: { name: string; parts: string[] }[]
  label: string
}) {
  return (
    <figure className="not-prose @container my-6 flex flex-col gap-2">
      {rows.map((r) => (
        <div
          key={r.name}
          className="grid gap-2 rounded-xl border bg-fd-card p-3 @xl:grid-cols-[9rem_1fr]"
        >
          <p className="text-xs font-semibold tracking-wide text-fd-muted-foreground uppercase">
            {r.name}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {r.parts.map((p) => (
              <li key={p} className="rounded-full border px-2.5 py-0.5 text-xs">
                {p}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <figcaption className="text-xs text-fd-muted-foreground">{label}</figcaption>
    </figure>
  )
}
