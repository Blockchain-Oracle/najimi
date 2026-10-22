"use client"

import { LOVES, TASTE_DOMAINS } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Check, Plus, Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useId, useState } from "react"
import type { LoveHit } from "@/app/api/qloo/search/route"
import { Artwork, shapeOf } from "@/components/artwork"
import { api } from "@/lib/fetcher"

export type { LoveHit }

const DOMAIN_OF = Object.fromEntries(TASTE_DOMAINS.map((d) => [d.type, d.key])) as Record<
  string,
  string
>
export const domainOf = (type: string) => DOMAIN_OF[type] ?? "brand"

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

/**
 * Search anything someone loves, across every Qloo domain, with artwork as they type (C1). The
 * caller owns what's picked; this only finds and offers.
 */
export function LoveSearch({
  picked,
  onPick,
  autoFocus = false,
  ensureSession,
}: {
  picked: Set<string>
  onPick: (hit: LoveHit) => void
  autoFocus?: boolean
  /** Runs before the first search (starts a guest on the onboarding page). */
  ensureSession?: () => Promise<void>
}) {
  const t = useTranslations("Loves")
  const tt = useTranslations("Types")
  const listId = useId()
  const [q, setQ] = useState("")
  const [active, setActive] = useState(0)
  const term = useDebounced(q.trim(), LOVES.searchDebounceMs)
  const enabled = term.length >= LOVES.searchMinChars

  const search = useQuery({
    queryKey: ["loves-search", term],
    queryFn: async () => {
      await ensureSession?.()
      return api<{ hits: LoveHit[] }>(`/api/qloo/search?${new URLSearchParams({ q: term })}`)
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  })
  const hits = enabled ? (search.data?.hits ?? []) : []
  // A new query starts the highlight at the top again.
  const [highlightFor, setHighlightFor] = useState(term)
  if (highlightFor !== term) {
    setHighlightFor(term)
    setActive(0)
  }

  const pick = (hit: LoveHit | undefined) => {
    if (!hit || picked.has(hit.qlooId)) return
    onPick(hit)
    setQ("")
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-3 rounded-pill bg-card px-4 py-3 text-card-foreground shadow-paper focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-5 shrink-0 text-paper-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, hits.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              pick(hits[active])
            }
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          aria-controls={listId}
          // biome-ignore lint/a11y/noAutofocus: opt-in, on the step whose only task is this search
          autoFocus={autoFocus}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-paper-muted"
        />
        {search.isFetching ? (
          <span
            role="status"
            className="size-2 animate-signal-pulse rounded-full bg-signal"
            aria-label={t("searching")}
          />
        ) : null}
      </label>

      {enabled && !search.isFetching && search.isSuccess && hits.length === 0 ? (
        <p className="px-2 text-sm text-text-3">{t("noResults", { query: term })}</p>
      ) : null}

      {hits.length ? (
        <ul id={listId} className="flex flex-col gap-1.5">
          {hits.map((hit, i) => {
            const isPicked = picked.has(hit.qlooId)
            return (
              <li key={hit.qlooId}>
                <button
                  type="button"
                  onClick={() => pick(hit)}
                  onMouseEnter={() => setActive(i)}
                  disabled={isPicked}
                  aria-label={t("add", { name: hit.name })}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-tile p-2 text-start transition-colors",
                    i === active ? "bg-raised" : "hover:bg-raised/60",
                  )}
                >
                  <Artwork
                    src={hit.image}
                    name={hit.name}
                    shape={shapeOf(hit.type)}
                    className="w-12 shrink-0"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{hit.name}</span>
                    <span className="truncate text-sm text-text-3">
                      {tt(domainOf(hit.type) as "artist")}
                      {hit.caption ? ` · ${hit.caption}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full",
                      isPicked
                        ? "bg-lime text-lime-foreground"
                        : "bg-sticker text-sticker-foreground",
                    )}
                  >
                    {isPicked ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
