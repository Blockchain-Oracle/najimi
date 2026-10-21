"use client"

import { useState } from "react"

/** Before and after in one frame: drag (or use the arrow keys) to reveal the original. */
export function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
}: {
  before: string
  after: string
  beforeLabel: string
  afterLabel: string
}) {
  const [at, setAt] = useState(50)
  return (
    <div className="relative overflow-hidden rounded-tile bg-ash select-none">
      {/* biome-ignore lint/performance/noImgElement: private, session-checked media */}
      <img src={after} alt={afterLabel} className="block h-auto w-full" draggable={false} />
      {/* biome-ignore lint/performance/noImgElement: private, session-checked media */}
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - at}% 0 0)` }}
        draggable={false}
      />
      <span
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ left: `${at}%` }}
      >
        <span className="absolute top-1/2 left-1/2 grid size-9 -translate-1/2 place-items-center rounded-full bg-lime text-xs font-bold text-lime-foreground shadow-sticker">
          ⇆
        </span>
      </span>
      <span className="pointer-events-none absolute start-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute end-2 top-2 rounded-pill bg-lime px-2 py-0.5 text-[11px] font-semibold text-lime-foreground">
        {afterLabel}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={at}
        onChange={(e) => setAt(Number(e.target.value))}
        aria-label={`${beforeLabel} / ${afterLabel}`}
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        dir="ltr"
      />
    </div>
  )
}
