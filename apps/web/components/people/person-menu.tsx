"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { toast } from "@najimi/ui/components/sonner"
import { Ban, Flag, MoreHorizontal } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { api } from "@/lib/fetcher"

/*
 * Safety on someone's profile (W25): block them (gone from search, twins, the radar and the map;
 * no follows or messages either way), or report them for review, which blocks them too.
 */

const REASONS = ["spam", "abuse", "fake", "other"] as const

export function PersonMenu({
  userId,
  name,
  className,
}: {
  userId: string
  name: string
  className?: string
}) {
  const t = useTranslations("Social")
  const router = useRouter()
  const block = async () => {
    await api("/api/people/block", { json: { userId } })
    toast(t("blocked", { name }))
    router.push("/people")
  }
  const report = async (reason: (typeof REASONS)[number]) => {
    await api("/api/reports", { json: { targetId: userId, reason } })
    toast(t("reported", { name }))
    router.push("/people")
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={t("more")} title={t("more")} className={className}>
        <MoreHorizontal className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={() => void block()}>
          <Ban /> {t("block", { name })}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {REASONS.map((r) => (
          <DropdownMenuItem key={r} onClick={() => void report(r)}>
            <Flag /> {t(`report.${r}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
