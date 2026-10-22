/** Every query key in one place, so invalidation can't miss one. */
export const qk = {
  qlooCall: (id: string) => ["qloo-call", id] as const,
  pickMedia: (id: string) => ["pick-media", id] as const,
  feed: ["feed"] as const,
}
