/** Every query key in one place, so invalidation can't miss one. */
export const qk = {
  qlooCall: (id: string) => ["qloo-call", id] as const,
  entity: (id: string, region: string) => ["entity", id, region] as const,
  feed: ["feed"] as const,
}
