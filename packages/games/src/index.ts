import type { GameItem, GameKind } from "@najimi/db/schema"

/*
 * The games' rules (W9), with no database or network: what a player may see before answering,
 * how an answer scores, and how Najimi plays. Rounds are built in ./build (from Qloo).
 */

export const GAME_KINDS = [
  "wavelength",
  "knowme",
  "twins",
  "blind",
] as const satisfies readonly GameKind[]

/** What a player sees before answering: everything but the truth. */
export type PublicItem = Omit<GameItem, "truth">

/**
 * The items without their truths. In "How well do you know me" the item *is* the right answer (the
 * subject's own love, also one of the options), so its identity goes and the options are numbered.
 */
export const publicItems = (items: GameItem[], kind: GameKind): PublicItem[] =>
  items.map(({ truth: _truth, ...rest }) =>
    kind === "knowme"
      ? {
          ...rest,
          qlooId: "",
          name: "",
          options: rest.options?.map((o, i) => ({ ...o, id: String(i) })),
        }
      : rest,
  )

/** Blind Taste's three answers: no, maybe, love. Qloo's 0–100 falls into the same three. */
export const BLIND_BANDS = { love: 72, maybe: 55 } as const
export const bandOf = (score: number) =>
  score >= BLIND_BANDS.love ? 2 : score >= BLIND_BANDS.maybe ? 1 : 0

/**
 * One player's answers, scored item by item (each out of 100):
 * - wavelength: how close the guess is to Qloo's number (10 points off costs 20);
 * - knowme, twins: the right choice;
 * - blind: whether you felt what Qloo predicted (`right` counts those for "Qloo was right").
 */
export function scoreOf(kind: GameKind, items: GameItem[], answers: number[]) {
  const perItem = items.map((item, i) => {
    const a = answers[i]
    if (a === undefined || !Number.isFinite(a)) return 0
    if (kind === "wavelength") return Math.max(0, Math.round(100 - 2 * Math.abs(a - item.truth)))
    if (kind === "blind") return bandOf(item.truth) === a ? 100 : 0
    return a === item.truth ? 100 : 0
  })
  return {
    perItem,
    score: perItem.reduce((n, s) => n + s, 0),
    right: perItem.filter((s) => s === 100).length,
  }
}

/** A small, repeatable random (Najimi's play is the same every time for a round). */
function seeded(seed: string) {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

/**
 * Najimi plays too: it reads tastes well but not perfectly. On the wavelength it lands 8–30
 * points off (about 62 points a thing, beatable by someone who knows them); on choices it's right
 * about two times in three.
 */
export function najimiPlays(kind: GameKind, items: GameItem[], seed: string): number[] {
  const rand = seeded(seed)
  return items.map((item) => {
    if (kind === "wavelength") {
      const off = 8 + rand() * 22
      const guess = item.truth + (rand() < 0.5 ? -off : off)
      return Math.max(0, Math.min(100, Math.round(guess)))
    }
    if (kind === "blind") return bandOf(item.truth)
    const n = item.options?.length ?? 1
    if (rand() < 0.66 || n < 2) return item.truth
    const wrong = (item.truth + 1 + Math.floor(rand() * (n - 1))) % n
    return wrong
  })
}
