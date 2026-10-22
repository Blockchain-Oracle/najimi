"use client"

import { useMutation } from "@tanstack/react-query"
import { Check, UserPlus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"
import { Face } from "@/components/taste/face"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"

export type PersonCard = {
  userId: string
  personId: string
  name: string
  username: string | null
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
  city: string | null
}

/** A face with their aura as a ring (their taste colours). */
export function AuraFace({
  person,
  size = "md",
}: {
  person: Pick<PersonCard, "look" | "name" | "aura">
  size?: "xs" | "sm" | "md" | "lg"
}) {
  const a = person.aura
  return (
    <span
      className="shrink-0 rounded-full p-[2px]"
      style={{
        background: a
          ? `conic-gradient(${a.c1}, ${a.c2}, ${a.c3}, ${a.c1})`
          : "conic-gradient(var(--color-aura-1), var(--color-aura-2), var(--color-aura-3), var(--color-aura-1))",
      }}
    >
      <span className="block rounded-full bg-background p-[2px]">
        <Face look={person.look} name={person.name} size={size} />
      </span>
    </span>
  )
}

/** Follow someone (Following once you do; Friends when they follow back). */
export function FollowButton({
  userId,
  initial,
}: {
  userId: string
  initial: { following: boolean; friends: boolean }
}) {
  const t = useTranslations("Social")
  const [state, setState] = useState(initial)
  const toggle = useMutation({
    mutationFn: () =>
      api<{ following: boolean; friends: boolean }>("/api/people/follow", {
        method: state.following ? "DELETE" : "POST",
        json: { userId },
      }),
    onMutate: () => {
      sound(state.following ? "tap" : "place")
      setState((s) => ({ following: !s.following, friends: !s.following && s.friends }))
    },
    onSuccess: (next) => setState({ following: next.following, friends: next.friends }),
    onError: () => setState(initial),
  })
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle.mutate()
      }}
      className={
        state.following
          ? "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-card px-3.5 text-[13px] font-semibold ring-1 ring-border"
          : "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground"
      }
    >
      {state.following ? <Check className="size-4" /> : <UserPlus className="size-4" />}
      {state.friends ? t("friends") : state.following ? t("following") : t("follow")}
    </button>
  )
}

/** One person in a list: face, name, @handle and city, and something to do on the right. */
export function PersonRow({
  person,
  note,
  trailing,
}: {
  person: PersonCard
  note?: string
  trailing?: ReactNode
}) {
  const href = person.username ? `/u/${person.username}` : null
  const body = (
    <>
      <AuraFace person={person} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold">{person.name}</span>
        <span className="truncate text-[13px] text-text-3">
          {[person.username ? `@${person.username}` : null, note ?? person.city]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </>
  )
  return (
    <li className="flex items-center gap-3 py-2">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      {trailing}
    </li>
  )
}
