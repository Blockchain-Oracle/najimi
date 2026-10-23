import type { CSSProperties } from "react"

/*
 * The services Najimi works with, as an endless row. After 21st.dev's Logo Cloud 3 by efferd (the
 * faded edges, the reversed slow drift, monochrome marks), moved from motion + react-use-measure
 * to one CSS keyframe so the docs ship no animation library. Marks are Simple Icons (CC0) drawn
 * as masks, so they take the text colour in light and dark; hover pauses the row.
 */

export type Brand = { name: string; logo?: string }

/** One brand's mark, drawn in the text colour (also used inline in tables). */
export function Logo({ name, className = "size-[18px]" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current align-[-0.2em] ${className}`}
      style={
        {
          maskImage: `url(/logos/${name}.svg)`,
          WebkitMaskImage: `url(/logos/${name}.svg)`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
        } as CSSProperties
      }
    />
  )
}

function Mark({ brand }: { brand: Brand }) {
  return (
    <span className="flex shrink-0 items-center gap-2 text-fd-muted-foreground">
      {brand.logo ? <Logo name={brand.logo} /> : null}
      <span className="text-[14px] font-semibold whitespace-nowrap">{brand.name}</span>
    </span>
  )
}

export function LogoCloud({ brands, seconds = 60 }: { brands: Brand[]; seconds?: number }) {
  return (
    <div
      className="not-prose group overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-label={brands.map((b) => b.name).join(", ")}
      role="img"
    >
      <div
        className="marquee-track flex w-max group-hover:[animation-play-state:paused] motion-safe:animate-[marquee_var(--marquee)_linear_infinite]"
        style={{ "--marquee": `${seconds}s` } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-11 pe-11" aria-hidden={copy === 1}>
            {brands.map((b) => (
              <Mark key={b.name} brand={b} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
