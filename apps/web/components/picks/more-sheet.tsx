"use client"

import type { StoredPick } from "@najimi/db/schema"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { api } from "@/lib/fetcher"
import { type PickActions, PickCard, PickCardSkeleton } from "./pick-card"

/** "More like this": the person's taste with this pick as the loudest love, in the same domain. */
export function MoreSheet({
  personId,
  seed,
  domain,
  onClose,
  actionsFor,
}: {
  personId: string
  seed: StoredPick | null
  domain: string | null
  onClose: () => void
  actionsFor: (pick: StoredPick) => PickActions
}) {
  const t = useTranslations("Pick")
  const more = useQuery({
    queryKey: ["more", personId, domain, seed?.qlooId],
    queryFn: () =>
      api<{ picks: StoredPick[] }>(
        `/api/people/${personId}/more?${new URLSearchParams({ domain: domain ?? "", seed: seed?.qlooId ?? "", name: seed?.name ?? "" })}`,
      ),
    enabled: Boolean(seed && domain),
    staleTime: 5 * 60 * 1000,
  })
  return (
    <Sheet open={Boolean(seed)} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent
        side="bottom"
        className="max-h-[85svh] rounded-t-sheet border-0 bg-background pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="font-title px-5 pt-5 text-xl">
          {seed ? t("moreLike", { name: seed.name }) : ""}
        </SheetTitle>
        <div className="flex snap-x gap-3 overflow-x-auto px-5 pt-2 pb-4">
          {more.data?.picks.length
            ? more.data.picks.map((p) => (
                <PickCard
                  key={p.qlooId}
                  pick={p}
                  actions={actionsFor(p)}
                  className="animate-card-land"
                />
              ))
            : more.isPending
              ? Array.from({ length: 4 }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
                  <PickCardSkeleton key={i} />
                ))
              : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
