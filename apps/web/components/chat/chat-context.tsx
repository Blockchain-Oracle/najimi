"use client"

import { toast } from "@najimi/ui/components/sonner"
import { createContext, useContext } from "react"
import { api } from "@/lib/fetcher"

/** The chat a card sits in (cards that share or act on their whole chat read it). */
const Ctx = createContext<{ chatId: string } | null>(null)
export const ChatProvider = Ctx.Provider
export const useChatId = () => useContext(Ctx)?.chatId ?? null

/** Makes (or reuses) the chat's public link and copies it. */
export async function shareChat(chatId: string, copied: string) {
  const { url } = await api<{ url: string }>("/api/shares", {
    json: { kind: "chat", refId: chatId },
  })
  await navigator.clipboard.writeText(url).catch(() => undefined)
  toast(copied, { description: url })
  return url
}
