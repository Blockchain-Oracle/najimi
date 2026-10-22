"use client"

/*
 * A win: a burst from the middle, then one from each side. After Magic UI's Confetti (21st.dev
 * dillionverma/confetti, MIT) and its side-cannons demo. canvas-confetti loads on the first win
 * (it needs the window), in the aura colours, and stays still under reduced motion.
 */

const aura = () => {
  const css = getComputedStyle(document.documentElement)
  return ["--aura-1", "--aura-2", "--aura-3", "--signal"]
    .map((name) => css.getPropertyValue(name).trim())
    .filter(Boolean)
}

export async function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  const { default: confetti } = await import("canvas-confetti")
  const colors = aura()
  confetti({ particleCount: 90, spread: 80, startVelocity: 45, origin: { x: 0.5, y: 0.4 }, colors })
  setTimeout(() => {
    for (const x of [0, 1])
      confetti({
        particleCount: 45,
        angle: x ? 120 : 60,
        spread: 60,
        startVelocity: 60,
        origin: { x, y: 0.7 },
        colors,
      })
  }, 260)
}
