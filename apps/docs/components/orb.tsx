import type { CSSProperties } from "react"

/*
 * The orb, exactly as in the app (packages/ui/src/components/orb.tsx): Najimi's presence, lit in
 * the agent's three taste colours. After 21st.dev's Siri Orb by educalvolpz (SmoothUI, MIT): six
 * conic gradients turning on one animated angle, blurred, with a dotted overlay. Pure CSS (the
 * keyframes live in app/global.css); `working` turns it faster; reduced motion stops it.
 */

type Props = {
  /** Diameter in px. */
  size?: number
  working?: boolean
  className?: string
  label?: string
}

const SMALL = 50
const TINY = 30
const MEDIUM = 100

export function Orb({ size = 192, working = false, className = "", label }: Props) {
  const small = size < SMALL
  const blur = small ? Math.max(size * 0.008, 1) : Math.max(size * 0.015, 4)
  const contrast = small ? Math.max(size * 0.004, 1.2) : Math.max(size * 0.008, 1.5)
  const dot = small ? Math.max(size * 0.004, 0.05) : Math.max(size * 0.008, 0.1)
  const spread = small ? Math.max(size * 0.004, 0.5) : Math.max(size * 0.008, 2)
  const mask = size < TINY ? "0%" : size < SMALL ? "5%" : size < MEDIUM ? "15%" : "25%"
  const finalContrast = size < TINY ? 1.1 : small ? Math.max(contrast * 1.2, 1.3) : contrast
  return (
    <span
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      data-mask={mask === "0%" ? "none" : undefined}
      className={`najimi-orb ${className}`}
      style={
        {
          width: size,
          height: size,
          "--orb-bg": "var(--color-fd-background)",
          "--orb-c1": "var(--aura-1)",
          "--orb-c2": "var(--aura-2)",
          "--orb-c3": "var(--aura-3)",
          "--orb-duration": working ? "6s" : "20s",
          "--orb-blur": `${blur}px`,
          "--orb-contrast": finalContrast,
          "--orb-dot": `${dot}px`,
          "--orb-spread": `${spread}px`,
          "--orb-mask": mask,
        } as CSSProperties
      }
    />
  )
}
