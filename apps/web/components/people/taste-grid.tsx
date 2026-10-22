"use client"

import { TASTE_DOMAINS } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import {
  BookOpen,
  Clapperboard,
  Gamepad2,
  type LucideIcon,
  MapPin,
  Mic,
  Music2,
  Plane,
  ShoppingBag,
  Tv,
  UserRound,
} from "lucide-react"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"

/*
 * A profile's grid (after Sora's and TikTok's profile grids, Refero 261b3605, 9d54f8a6): artwork
 * edge to edge, three across on a phone, the name over a fade and a small badge for its kind.
 * Filter chips above choose a kind. Tiles without artwork set their name large on the aura.
 */

export const KIND_ICON: Record<string, LucideIcon> = {
  artist: Music2,
  movie: Clapperboard,
  tv_show: Tv,
  book: BookOpen,
  podcast: Mic,
  brand: ShoppingBag,
  place: MapPin,
  destination: Plane,
  videogame: Gamepad2,
  person: UserRound,
}

export const kindOf = (type: string) => type.replace("urn:entity:", "")

/** Qloo's images come in any width; tiles ask for a small one. */
const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : url

export type GridItem = { id: string; type: string; name: string; image: string | null }

export function GridTile({
  item,
  onOpen,
  index,
}: {
  item: GridItem
  onOpen: () => void
  index: number
}) {
  const td = useTranslations("Domains")
  const kind = kindOf(item.type)
  const Icon = KIND_ICON[kind] ?? Music2
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.4), duration: 0.25 }}
      whileTap={{ scale: 0.97 }}
      aria-label={`${td(kind as "artist")}: ${item.name}`}
      className="group relative aspect-square overflow-hidden bg-card text-start"
    >
      {item.image ? (
        // biome-ignore lint/performance/noImgElement: remote artwork tile
        <img
          src={sized(item.image, 420) ?? item.image}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center bg-[radial-gradient(80%_80%_at_30%_20%,var(--color-aura-2),transparent_70%),radial-gradient(80%_80%_at_80%_90%,var(--color-aura-1),transparent_70%)] p-3">
          <span className="font-title line-clamp-3 text-center text-[17px] leading-tight text-white">
            {item.name}
          </span>
        </span>
      )}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/0 to-black/0"
      />
      <span
        aria-hidden
        className="absolute start-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-md"
      >
        <Icon className="size-3.5" />
      </span>
      {item.image ? (
        <span className="absolute inset-x-2 bottom-1.5 line-clamp-2 text-[12px] leading-tight font-semibold text-white">
          {item.name}
        </span>
      ) : null}
    </motion.button>
  )
}

export function Grid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-3 gap-0.5 overflow-hidden sm:grid-cols-4 md:gap-1 md:rounded-card",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Kinds as chips: All, then each kind there is something of. */
export function KindChips({
  kinds,
  value,
  onChange,
}: {
  kinds: string[]
  value: string | null
  onChange: (kind: string | null) => void
}) {
  const t = useTranslations("Taste")
  const td = useTranslations("Domains")
  const chip = (on: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
      on ? "bg-primary text-primary-foreground" : "bg-card text-text-2 hover:text-foreground",
    )
  return (
    <div className="flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:px-0">
      <button type="button" className={chip(value === null)} onClick={() => onChange(null)}>
        {t("all")}
      </button>
      {kinds.map((k) => {
        const Icon = KIND_ICON[k] ?? Music2
        return (
          <button key={k} type="button" className={chip(value === k)} onClick={() => onChange(k)}>
            <Icon className="size-3.5" />
            {td(k as "artist")}
          </button>
        )
      })}
    </div>
  )
}

/** Every domain's picks woven together (one of each kind in turn), artwork first. */
export function weave<T extends { image: string | null }>(byDomain: Record<string, T[]>): T[] {
  const order = TASTE_DOMAINS.map((d) => d.key)
  const lists = order.map((k) => [...(byDomain[k] ?? [])])
  const out: T[] = []
  while (lists.some((l) => l.length)) {
    for (const list of lists) {
      const next = list.shift()
      if (next) out.push(next)
    }
  }
  return [...out.filter((x) => x.image), ...out.filter((x) => !x.image)]
}
