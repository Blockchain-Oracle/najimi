"use client"

/** Who a taste leans to (Qloo urn:demographics): above or below average, per age band and gender. */
export function DemographicsView({
  age,
  gender,
  label,
}: {
  age: Record<string, number>
  gender: Record<string, number>
  label: (key: string) => string
}) {
  const rows = [...Object.entries(age), ...Object.entries(gender)]
  const max = Math.max(...rows.map(([, v]) => Math.abs(v)), 0.01)
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(([key, value], i) => (
        <li
          key={key}
          className={
            i === Object.keys(age).length
              ? "mt-2 grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs"
              : "grid grid-cols-[7rem_1fr_3rem] items-center gap-2 text-xs"
          }
        >
          <span className="font-semibold">{label(key)}</span>
          <span className="relative h-2.5 rounded-full bg-paper-foreground/6">
            <span className="absolute inset-y-0 start-1/2 w-px bg-paper-foreground/25" />
            <span
              className={
                value >= 0
                  ? "absolute inset-y-0 start-1/2 rounded-e-full bg-lime-ink"
                  : "absolute inset-y-0 end-1/2 rounded-s-full bg-paper-muted/60"
              }
              style={{ width: `${(Math.abs(value) / max) * 50}%` }}
            />
          </span>
          <span className="text-end text-paper-muted tnum">
            {value > 0 ? "+" : ""}
            {Math.round(value * 100)}
          </span>
        </li>
      ))}
    </ul>
  )
}
