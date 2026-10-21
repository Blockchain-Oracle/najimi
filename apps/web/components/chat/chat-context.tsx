"use client"

import { createContext, useContext } from "react"
import { shareLink } from "@/lib/share-link"

/** The chat a card sits in (cards that share or act on their whole chat read it). */
const Ctx = createContext<{ chatId: string } | null>(null)
export const ChatProvider = Ctx.Provider
export const useChatId = () => useContext(Ctx)?.chatId ?? null

/** Makes (or reuses) the chat's public link and copies it. */
export const shareChat = (chatId: string, copied: string) => shareLink("chat", chatId, copied)
