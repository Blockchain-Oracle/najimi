"use client"

/** A taste in words: bigger and brighter where Qloo's affinity is higher, grouped by kind. */
export function TagCloud({
  tags,
  kindLabel,
}: {
  tags: { id: string; name: string; type: string; affinity: number | null }[]
  kindLabel: (type: string) => string
}) {
  const groups = new Map<string, typeof tags>()
  for (const t of tags) {
    const kind = t.type.split(":")[2] ?? "other"
    groups.set(kind, [...(groups.get(kind) ?? []), t])
  }
  return (
    <div className="flex flex-col gap-3">
      {[...groups.entries()].map(([kind, list]) => (
        <div key={kind} className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
            {kindLabel(kind)}
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            {list.map((t, i) => {
              // By rank within its kind: Qloo's affinities for a profile's words sit close together.
              const strength = list.length > 1 ? 1 - i / (list.length - 1) : 1
              return (
                <span
                  key={t.id}
                  className="animate-settle-in font-title leading-none"
                  style={
                    {
                      fontSize: `${0.9 + strength * 0.55}rem`,
                      opacity: 0.55 + strength * 0.45,
                      "--enter-delay": `${i * 35}ms`,
                    } as React.CSSProperties
                  }
                  title={t.affinity != null ? `${Math.round(t.affinity * 100)}%` : undefined}
                >
                  {t.name}
                </span>
              )
            })}
          </p>
        </div>
      ))}
    </div>
  )
}
