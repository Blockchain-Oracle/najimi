"use client"

import Link from "next/link"
import { createContext, type ReactNode, useContext } from "react"
import { shareLink } from "@/lib/share-link"
import { usePublicShare } from "./public-share"

/**
 * The chat a card sits in: its id (cards that share or act on their whole chat) and the people
 * the owner keeps (so any card that names someone can lead to them).
 */
type ChatContext = { chatId: string; people?: { id: string; name: string }[]; me?: string }
const Ctx = createContext<ChatContext | null>(null)
export const ChatProvider = Ctx.Provider
export const useChatId = () => useContext(Ctx)?.chatId ?? null
/** Who is looking (actions only the owner of something may take). */
export const useMe = () => useContext(Ctx)?.me ?? null

/** Makes (or reuses) the chat's public link and copies it. */
export const shareChat = (chatId: string, copied: string) => shareLink("chat", chatId, copied)

/**
 * A person's name that leads to their taste page, found by id or by name among the owner's
 * people. Plain text in a shared chat (a stranger has no way in) or when no one matches.
 */
export function PersonName({ name, id }: { name: string; id?: string | null }) {
  const people = useContext(Ctx)?.people
  const shared = usePublicShare() !== null
  const person =
    people?.find((p) => p.id === id) ??
    people?.find((p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())
  if (shared || !person) return <>{name}</>
  return (
    <Link
      href={`/people/${person.id}`}
      className="font-semibold text-paper-foreground underline decoration-paper-foreground/30 underline-offset-2 hover:decoration-paper-foreground focus-visible:decoration-paper-foreground"
    >
      {name}
    </Link>
  )
}

const MARK = "⁣"

/**
 * A translated line with the person's name in it, the name linked. The line is translated with
 * a marker in place of the name, so word order stays the language's own.
 */
export function WithPerson({
  text,
  name,
  id,
}: {
  /** The translation, called with the marker as the name. */
  text: (name: string) => string
  name: string
  id?: string | null
}): ReactNode {
  const [before, ...after] = text(MARK).split(MARK)
  if (!after.length) return text(name)
  return (
    <>
      {before}
      <PersonName name={name} id={id} />
      {after.join(name)}
    </>
  )
}
