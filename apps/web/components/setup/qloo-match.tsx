"use client"

import { Button } from "@najimi/ui/components/button"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Artwork } from "@/components/artwork"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"

export type Match = {
  id: string
  role: "own" | "candidate" | "comparable" | "competitor"
  entityId: string
  name: string
  data: {
    image?: string | null
    type?: string | null
    properties?: { address?: string; neighborhood?: string }
  }
  evidence: string[]
  route: string | null
}

const EVIDENCE: Record<string, string> = {
  website: "Same website",
  address: "Same address",
  "external-id": "Same social account",
  name: "Same name",
  owner: "You confirmed it",
}

const ROUTE: Record<string, string> = {
  "competitive-set": "the brands Qloo lists as your competitive set",
  neighbours: "places near you that share your audience",
  "site-suggestions": "places like yours, named from your site",
}

const where = (m: Match) => m.data.properties?.neighborhood ?? m.data.properties?.address ?? null

/**
 * The business in Qloo (F2): matched with the evidence why; or the candidates to choose from
 * (SAFE_USE: ambiguous matches are shown, never guessed); or the comparables used instead (R12).
 */
export function QlooMatch({
  businessId,
  status,
  matches,
  connected,
}: {
  businessId: string
  status: string
  matches: Match[]
  /** Whether this server has a Qloo key: an empty section says which kind of empty it is. */
  connected: boolean
}) {
  const queryClient = useQueryClient()
  const choose = useMutation({
    mutationFn: (input: { entityId: string } | { none: true }) =>
      api(`/api/businesses/${businessId}/match`, { json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.business(businessId) }),
  })
  const own = matches.find((m) => m.role === "own")
  const candidates = matches.filter((m) => m.role === "candidate")
  const comparables = matches.filter((m) => m.role === "comparable")

  return (
    <section aria-labelledby="qloo-title" className="flex flex-col gap-4">
      <h2 id="qloo-title" className="border-b border-foreground pb-2 text-xs font-bold uppercase">
        You in Qloo
      </h2>

      {status === "confirm" ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-2">
            Qloo has a few places that could be you. Which one is it?
          </p>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {candidates.map((c) => (
              <li key={c.id} className="flex flex-col gap-2">
                <Artwork src={c.data.image} name={c.name} shape="place" />
                <span className="text-sm font-bold">{c.name}</span>
                {where(c) ? <span className="text-xs text-text-3">{where(c)}</span> : null}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={choose.isPending}
                  onClick={() => choose.mutate({ entityId: c.entityId })}
                >
                  This is us
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            disabled={choose.isPending}
            onClick={() => choose.mutate({ none: true })}
          >
            None of these
          </Button>
        </div>
      ) : own ? (
        <div className="flex items-center gap-4">
          <Artwork src={own.data.image} name={own.name} shape="place" className="w-28 shrink-0" />
          <div className="flex flex-col gap-2">
            <span className="text-base font-bold">{own.name}</span>
            <span className="flex flex-wrap gap-1.5">
              {own.evidence.map((e) => (
                <span key={e} className="rounded-tag border border-border px-2.5 py-0.5 text-xs">
                  {EVIDENCE[e] ?? e}
                </span>
              ))}
            </span>
          </div>
        </div>
      ) : comparables.length ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-2">
            You're not in Qloo yet, so we'll find your people through{" "}
            {ROUTE[comparables[0]?.route ?? ""] ?? "places like you"}:
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {comparables.map((c) => (
              <li key={c.id} className="rounded-tag border border-border px-2.5 py-0.5 text-xs">
                {c.name}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-text-2">
          {!connected
            ? "Qloo isn't connected yet. Your people will appear once it is."
            : status === "matching"
              ? "Looking for you in Qloo…"
              : "Not in Qloo yet, and nothing similar was found."}
        </p>
      )}
      {choose.error ? <p className="text-sm text-text-2">{choose.error.message}</p> : null}
    </section>
  )
}
