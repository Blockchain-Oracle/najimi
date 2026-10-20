import { cn } from "@najimi/ui/lib/utils"

const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
  "35_and_younger": "35 and under",
  "36_to_55": "36–55",
}
const GENDER_LABELS: Record<string, string> = { male: "Men", female: "Women" }
const AGE_ORDER = Object.keys(AGE_LABELS)

const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`

/**
 * Who your people are, as lean (dataviz: diverging bars from one baseline). Right of the line =
 * more than average, left = less; position carries the meaning, ink vs grey only repeats it, and
 * every bar has its value (the design lock allows no hue). A table repeats it for screen readers.
 */
export function LeanBars({
  age,
  gender,
}: {
  age: Record<string, number>
  gender: Record<string, number>
}) {
  const rows = [
    ...AGE_ORDER.filter((k) => k in age).map((k) => ({
      key: k,
      label: AGE_LABELS[k] ?? k,
      value: age[k] ?? 0,
    })),
    ...Object.entries(gender).map(([k, v]) => ({ key: k, label: GENDER_LABELS[k] ?? k, value: v })),
  ]
  if (!rows.length)
    return <p className="text-sm text-text-3">Qloo has no age or gender lean for this yet.</p>
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.01)
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 grid grid-cols-[7rem_1fr] text-[11px] text-text-3">
        <span />
        <span className="flex justify-between">
          <span>Less than average</span>
          <span>More than average</span>
        </span>
      </div>
      <ul aria-hidden className="flex flex-col gap-0.5">
        {rows.map((row, i) => {
          const width = `${(Math.abs(row.value) / max) * 50}%`
          const above = row.value >= 0
          const isGenderStart =
            i > 0 && row.key in GENDER_LABELS && !((rows[i - 1]?.key ?? "") in GENDER_LABELS)
          return (
            <li
              key={row.key}
              title={`${row.label}: ${signed(row.value)} (${above ? "more" : "less"} than average)`}
              className={cn(
                "grid grid-cols-[7rem_1fr] items-center py-1 text-sm",
                isGenderStart && "mt-3",
              )}
            >
              <span className="text-text-2">{row.label}</span>
              <span className="relative h-4">
                <span className="absolute inset-y-[-4px] left-1/2 w-px bg-border" />
                <span
                  className={cn(
                    "absolute top-0 h-4",
                    above
                      ? "left-1/2 rounded-r-[4px] bg-foreground"
                      : "right-1/2 rounded-l-[4px] bg-text-3",
                  )}
                  style={{ width }}
                />
                <span
                  className={cn(
                    "tnum absolute top-1/2 -translate-y-1/2 text-xs",
                    above ? "pl-1.5" : "pr-1.5",
                  )}
                  style={
                    above ? { left: `calc(50% + ${width})` } : { right: `calc(50% + ${width})` }
                  }
                >
                  {signed(row.value)}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <table className="sr-only">
        <caption>How much more or less than average each group leans towards these tastes</caption>
        <thead>
          <tr>
            <th>Group</th>
            <th>Lean</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              <td>{signed(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
