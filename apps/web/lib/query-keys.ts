/** Every query key in one place, so invalidation can't miss one. */
export const qk = {
  business: (id: string) => ["business", id] as const,
  qlooCalls: (id: string) => ["business", id, "qloo-calls"] as const,
}
