"use client"

import { createContext, useContext } from "react"

/**
 * Inside a shared (public) chat: media is read with the share token, finished creations are known
 * up front (no live events for strangers), and nothing private or actionable is shown.
 */
export type PublicShare = { token: string; ready: string[] }
const Ctx = createContext<PublicShare | null>(null)

export const PublicShareProvider = Ctx.Provider
export const usePublicShare = () => useContext(Ctx)

/** A creation's media link, with the share token when the page is a shared chat. */
export function useMediaUrl() {
  const share = usePublicShare()
  return (id: string, v: "original" | "display" | "thumb" = "display") =>
    `/api/media/creation/${id}?v=${v}${share ? `&share=${encodeURIComponent(share.token)}` : ""}`
}
