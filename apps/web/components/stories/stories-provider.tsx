"use client"

import { cn } from "@najimi/ui/lib/utils"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import { Face } from "@/components/taste/face"
import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"
import type { StoryCard, TrayPerson } from "@/lib/stories"
import { StoryComposer } from "./story-composer"
import { StoryViewer, type Viewing } from "./story-viewer"

/*
 * Stories everywhere people appear (S18): one provider holds the tray (you and the people you
 * follow with something up), opens the viewer from any face with a ring, and the composer from
 * "Your story". A ring is the aura while there's something you haven't seen, quiet once you have.
 */

type StoriesApi = {
  tray: TrayPerson[]
  /** Plays someone's stories (then the rest of the tray after them). */
  open: (
    userId: string,
    person?: Omit<TrayPerson, "count" | "unseen" | "latestAt" | "mine">,
  ) => void
  compose: () => void
}

const StoriesContext = createContext<StoriesApi | null>(null)

export function StoriesProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession()
  const me = session.data?.user.id ?? null
  const tray = useQuery({
    queryKey: ["stories", "tray"],
    queryFn: () => api<{ tray: TrayPerson[] }>("/api/stories"),
    enabled: Boolean(me),
    staleTime: 30_000,
    refetchInterval: 2 * 60_000,
  })
  const people = tray.data?.tray ?? []
  const [viewing, setViewing] = useState<Viewing | null>(null)
  const [composing, setComposing] = useState(false)

  const open = useCallback<StoriesApi["open"]>(
    (userId, person) => {
      const at = people.findIndex((p) => p.userId === userId)
      if (at !== -1) return setViewing({ people, index: at })
      // Someone not in your tray (a public profile you don't follow): just their stories.
      if (person)
        setViewing({
          people: [{ ...person, mine: person.userId === me, count: 0, unseen: 0, latestAt: "" }],
          index: 0,
        })
    },
    [people, me],
  )
  const value = useMemo(
    () => ({ tray: people, open, compose: () => setComposing(true) }),
    [people, open],
  )

  return (
    <StoriesContext.Provider value={value}>
      {children}
      {viewing ? <StoryViewer viewing={viewing} me={me} onClose={() => setViewing(null)} /> : null}
      {composing ? <StoryComposer onClose={() => setComposing(false)} /> : null}
    </StoriesContext.Provider>
  )
}

export function useStories() {
  const api = useContext(StoriesContext)
  if (!api) throw new Error("useStories needs StoriesProvider")
  return api
}

/**
 * Someone's face with their story ring: a tap plays their stories. Without stories it's just the
 * face (and whatever it wraps keeps its own tap). `probe` asks for someone outside your tray (a
 * profile you opened).
 */
export function StoryRing({
  userId,
  name,
  look,
  username = null,
  children,
  probe = false,
  decorative = false,
  className,
}: {
  userId: string
  name: string
  look: string | null
  username?: string | null
  children: ReactNode
  probe?: boolean
  /** Inside something that's already a link (a chat row): the ring shows, the row keeps the tap. */
  decorative?: boolean
  className?: string
}) {
  const t = useTranslations("Stories")
  const { tray, open } = useStories()
  const inTray = tray.find((p) => p.userId === userId)
  const theirs = useQuery({
    queryKey: ["stories", "of", userId],
    queryFn: () => api<{ stories: StoryCard[] }>(`/api/stories/of/${userId}`),
    enabled: probe && !inTray,
    staleTime: 60_000,
    retry: false,
  })
  const count = inTray?.count ?? theirs.data?.stories.length ?? 0
  const unseen = inTray ? inTray.unseen > 0 : (theirs.data?.stories.some((s) => !s.seen) ?? false)
  if (!count) return <>{children}</>
  const ring = unseen
    ? "bg-[conic-gradient(from_200deg,var(--color-aura-1),var(--color-aura-2),var(--color-aura-1))]"
    : "bg-white/25"
  if (decorative)
    return (
      <span className={cn("relative block shrink-0 rounded-full p-[2px]", ring, className)}>
        <span className="block rounded-full bg-background p-[1.5px]">{children}</span>
      </span>
    )
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        open(userId, { userId, name, look, username })
      }}
      aria-label={t("watch", { name })}
      className={cn(
        "relative shrink-0 rounded-full p-[2.5px]",
        unseen
          ? "bg-[conic-gradient(from_200deg,var(--color-aura-1),var(--color-aura-2),var(--color-aura-1))]"
          : "bg-white/25",
        className,
      )}
    >
      <span className="block rounded-full bg-background p-[2px]">{children}</span>
    </button>
  )
}

/** The People tab's row of stories: yours first (with +), then everyone you follow with one up. */
export function StoryTray() {
  const t = useTranslations("Stories")
  const { tray, open, compose } = useStories()
  const session = authClient.useSession()
  const me = session.data?.user
  const mine = tray.find((p) => p.mine)
  const others = tray.filter((p) => !p.mine)
  return (
    <section aria-label={t("title")} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex gap-4">
        <li className="w-16 shrink-0">
          <div className="relative flex flex-col items-center gap-1.5">
            {mine ? (
              <button
                type="button"
                onClick={() => open(mine.userId)}
                aria-label={t("watch", { name: t("yourStory") })}
                className={cn(
                  "rounded-full p-[2.5px]",
                  "bg-[conic-gradient(from_200deg,var(--color-aura-1),var(--color-aura-2),var(--color-aura-1))]",
                )}
              >
                <span className="block rounded-full bg-background p-[2px]">
                  <Face look={mine.look} name={mine.name} size="lg" />
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={compose}
                aria-label={t("new")}
                className="rounded-full p-[4.5px]"
              >
                <Face look={null} name={me?.name ?? "?"} size="lg" />
              </button>
            )}
            <button
              type="button"
              onClick={compose}
              aria-label={t("new")}
              className="absolute top-12 end-0 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
            >
              <Plus className="size-4" />
            </button>
            <span className="w-full truncate text-center text-[12px] font-semibold">
              {t("yourStory")}
            </span>
          </div>
        </li>
        {others.map((p) => (
          <li key={p.userId} className="w-16 shrink-0">
            <button
              type="button"
              onClick={() => open(p.userId)}
              className="flex w-full flex-col items-center gap-1.5"
            >
              <span
                className={cn(
                  "rounded-full p-[2.5px]",
                  p.unseen
                    ? "bg-[conic-gradient(from_200deg,var(--color-aura-1),var(--color-aura-2),var(--color-aura-1))]"
                    : "bg-white/25",
                )}
              >
                <span className="block rounded-full bg-background p-[2px]">
                  <Face look={p.look} name={p.name} size="lg" />
                </span>
              </span>
              <span
                className={cn(
                  "w-full truncate text-center text-[12px]",
                  p.unseen ? "font-semibold" : "text-text-3",
                )}
              >
                {p.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
