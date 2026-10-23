"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import { useAgent } from "@/components/agent/agent-context"
import { usePublicShare } from "@/components/chat/public-share"
import { authClient } from "@/lib/auth-client"
import type { EntityDetails, EntityRef } from "@/lib/entity"
import { api } from "@/lib/fetcher"
import { EntitySheet, type Surface } from "./entity-sheet"

/*
 * Tap anything (R1): one entity sheet for the whole app. Any card that shows a thing (a film in a
 * chat answer, a stop on a plan, a node on the graph, a stamp in the Passport) calls
 * `useEntity().open(thing)`, and the same sheet plays it, links it and offers the same actions:
 * Keep, More like this (Najimi finds them), Ask Najimi, Share, Not for me.
 */

type OpenOptions = {
  /** Where it was opened (kept with the signals it makes). */
  surface?: Surface
  /** A shared page, signed out: look, play and share, nothing to keep. */
  readOnly?: boolean
}
type Opened = { thing: EntityRef; surface: Surface; readOnly: boolean }

const EntityContext = createContext<{
  open: (thing: EntityRef, options?: OpenOptions) => void
} | null>(null)

export function EntityProvider({ children }: { children: ReactNode }) {
  const tp = useTranslations("Pick")
  const agent = useAgent()
  const askAbout = useAskAbout()
  const queryClient = useQueryClient()
  const session = authClient.useSession()
  const [opened, setOpened] = useState<Opened | null>(null)
  // Signed out (a shared plan or chat), there's nothing to keep or hide.
  const signedIn = Boolean(session.data)

  const open = useCallback(
    (thing: EntityRef, options: OpenOptions = {}) =>
      setOpened({ thing, surface: options.surface ?? "room", readOnly: Boolean(options.readOnly) }),
    [],
  )
  const value = useMemo(() => ({ open }), [open])

  const signal = (o: Opened, kind: "save" | "unsave" | "hide") =>
    api("/api/feed/signals", {
      json: {
        signals: [
          {
            qlooId: o.thing.qlooId,
            type: o.thing.type,
            kind,
            surface: o.surface,
            name: o.thing.name,
            image: o.thing.image,
          },
        ],
      },
    })

  const setSaved = (id: string, saved: boolean) =>
    queryClient.setQueriesData<EntityDetails>({ queryKey: ["entity", id] }, (d) =>
      d ? { ...d, saved } : d,
    )

  const actions =
    opened && !opened.readOnly && signedIn
      ? {
          onToggleSave: async (saved: boolean) => {
            setSaved(opened.thing.qlooId, !saved)
            try {
              await signal(opened, saved ? "unsave" : "save")
            } catch (e) {
              setSaved(opened.thing.qlooId, saved)
              toast.error(e instanceof Error ? e.message : "")
            }
          },
          onMore: () => {
            setOpened(null)
            agent.ask(tp("moreLike", { name: opened.thing.name }))
          },
          onAsk: () => {
            const { thing } = opened
            setOpened(null)
            askAbout(thing)
          },
          onNotForMe: async () => {
            const o = opened
            setOpened(null)
            try {
              await signal(o, "hide")
              toast(tp("removed"))
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "")
            }
          },
        }
      : {}

  return (
    <EntityContext.Provider value={value}>
      {children}
      <EntitySheet
        thing={opened?.thing ?? null}
        surface={opened?.surface}
        actions={actions}
        onClose={() => setOpened(null)}
      />
    </EntityContext.Provider>
  )
}

/** Opens Najimi on this thing: it knows what you mean (the screen) and is asked about it. */
export function useAskAbout() {
  const te = useTranslations("Entity")
  const agent = useAgent()
  return (thing: EntityRef) => {
    agent.setScreen({ where: "thing", label: thing.name, qlooId: thing.qlooId, type: thing.type })
    agent.ask(te("askAbout", { name: thing.name }))
  }
}

export function useEntity() {
  const api = useContext(EntityContext)
  if (!api) throw new Error("useEntity needs EntityProvider")
  return api
}

/**
 * Wraps whatever a card shows for a thing (its artwork, its name) so a tap opens it in the sheet.
 * Without a Qloo id there's nothing to open: the content stays plain, never a dead link.
 */
export function OpenThing({
  thing,
  surface = "room",
  className,
  children,
  chevron = false,
}: {
  thing: (Omit<EntityRef, "qlooId"> & { qlooId?: string | null }) | null
  surface?: Surface
  className?: string
  children: ReactNode
  /** A name in a row: a small arrow says it opens (phones have no hover). */
  chevron?: boolean
}) {
  const entity = useEntity()
  const t = useTranslations("Pick")
  const share = usePublicShare()
  if (!thing?.qlooId) return <span className={className}>{children}</span>
  const ref = { ...thing, qlooId: thing.qlooId }
  return (
    <button
      type="button"
      onClick={() => entity.open(ref, { surface, readOnly: Boolean(share) })}
      aria-label={t("openThing", { name: thing.name })}
      className={cn(
        "group/open min-w-0 cursor-pointer text-start outline-none focus-visible:ring-2 focus-visible:ring-ring",
        chevron && "inline-flex items-center gap-0.5",
        className,
      )}
    >
      {children}
      {chevron ? (
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 opacity-50 transition-transform group-hover/open:translate-x-0.5"
        />
      ) : null}
    </button>
  )
}
