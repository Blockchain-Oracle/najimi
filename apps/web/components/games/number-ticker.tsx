"use client"

import { cn } from "@najimi/ui/lib/utils"
import { useMotionValue, useReducedMotion, useSpring } from "motion/react"
import { useEffect, useRef } from "react"

/*
 * A score that counts up to its number on a spring, the text written straight into the node (no
 * re-render per frame). It counts from the last value rather than zero (a running score climbs)
 * and stays still under reduced motion.
 */
export function NumberTicker({
  value,
  delay = 0,
  className,
}: {
  value: number
  /** Seconds before it starts counting. */
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const still = useReducedMotion()
  const motion = useMotionValue(still ? value : 0)
  const spring = useSpring(motion, { damping: 40, stiffness: 120 })

  useEffect(() => {
    if (still) {
      motion.jump(value)
      return
    }
    const id = setTimeout(() => motion.set(value), delay * 1000)
    return () => clearTimeout(id)
  }, [motion, value, delay, still])

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = Math.round(latest).toLocaleString()
      }),
    [spring],
  )

  return (
    <span ref={ref} className={cn("inline-block tabular-nums", className)}>
      {still ? value.toLocaleString() : "0"}
    </span>
  )
}
