"use client"

import { Dialog, DialogContent, DialogTitle } from "@najimi/ui/components/dialog"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Download, MessageSquare, Play, Share2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

type Creation = {
  id: string
  kind: "image" | "video"
  purpose: string
  title: string | null
  words: string[]
  width: number | null
  height: number | null
  chatId: string | null
  sourceCreationId: string | null
  createdAt: string
}

const url = (id: string, v: "thumb" | "display" | "original") => `/api/media/creation/${id}?v=${v}`

/** Every creation in one grid (T16), with a viewer: download, share, delete, back to its chat. */
export function AssetsGrid() {
  const t = useTranslations("Assets")
  const tm = useTranslations("Make")
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<"all" | "image" | "video">("all")
  const [open, setOpen] = useState<Creation | null>(null)
  const list = useInfiniteQuery({
    queryKey: ["creations", kind],
    queryFn: ({ pageParam }) =>
      api<{ creations: Creation[]; next: string | null }>(
        `/api/creations?${new URLSearchParams({ ...(kind !== "all" ? { kind } : {}), ...(pageParam ? { before: pageParam } : {}) })}`,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  })
  const items = list.data?.pages.flatMap((p) => p.creations) ?? []

  const share = async (c: Creation) => {
    const { url: link } = await api<{ url: string }>("/api/shares", {
      json: { kind: "creation", refId: c.id },
    })
    await navigator.clipboard.writeText(link).catch(() => undefined)
    toast(tm("linkCopied"))
  }
  const remove = async (c: Creation) => {
    if (!window.confirm(t("confirmDelete"))) return
    await api(`/api/creations/${c.id}`, { method: "DELETE" })
    setOpen(null)
    await queryClient.invalidateQueries({ queryKey: ["creations"] })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5">
        {(["all", "image", "video"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-pill px-3.5 py-1.5 text-sm font-semibold",
              kind === k ? "bg-foreground text-background" : "hover:bg-secondary",
            )}
          >
            {t(`kinds.${k}`)}
          </button>
        ))}
      </div>
      {list.isSuccess && !items.length ? (
        <div className="flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-foreground/15 p-8">
          <p className="text-text-2">{t("empty")}</p>
          <Link href="/c" className="sticker px-4 py-2 text-sm font-semibold">
            {t("startMaking")}
          </Link>
        </div>
      ) : null}
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
        {items.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setOpen(c)}
            className="print mb-5 block w-full break-inside-avoid text-start transition-transform hover:-translate-y-0.5"
          >
            <span className="relative block">
              {/* biome-ignore lint/performance/noImgElement: private, session-checked media */}
              <img
                src={url(c.kind === "video" ? (c.sourceCreationId ?? c.id) : c.id, "thumb")}
                alt=""
                loading="lazy"
                decoding="async"
                width={c.width ?? undefined}
                height={c.height ?? undefined}
                className="h-auto w-full rounded-sm"
              />
              {c.kind === "video" ? (
                <span className="absolute inset-0 grid place-items-center">
                  <Play className="size-10 fill-white text-white drop-shadow" />
                </span>
              ) : null}
            </span>
            <span className="mt-1.5 block truncate text-xs font-semibold text-paper-foreground">
              {c.title}
            </span>
          </button>
        ))}
      </div>
      {list.hasNextPage ? (
        <button
          type="button"
          onClick={() => list.fetchNextPage()}
          className="sticker self-center px-4 py-2 text-sm font-semibold"
        >
          {t("more")}
        </button>
      ) : null}
      <Dialog open={Boolean(open)} onOpenChange={(o) => (o ? null : setOpen(null))}>
        <DialogContent className="max-h-[92svh] max-w-4xl overflow-y-auto rounded-sheet border-0 bg-background p-4 sm:max-w-4xl">
          {open ? (
            <>
              <DialogTitle className="font-title text-xl">{open.title}</DialogTitle>
              {open.kind === "video" ? (
                // biome-ignore lint/a11y/useMediaCaption: generated video with no speech
                <video
                  src={url(open.id, "original")}
                  poster={open.sourceCreationId ? url(open.sourceCreationId, "display") : undefined}
                  controls
                  autoPlay
                  playsInline
                  className="w-full rounded-tile bg-black"
                />
              ) : (
                // biome-ignore lint/performance/noImgElement: private, session-checked media
                <img
                  src={url(open.id, "display")}
                  alt={open.title ?? ""}
                  className="w-full rounded-tile"
                />
              )}
              {open.words.length ? (
                <p className="text-sm text-text-2">
                  <span className="text-text-3">{t("madeFrom")} </span>
                  {open.words.join(" · ")}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <a
                  href={url(open.id, "original")}
                  download
                  className="sticker inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold"
                >
                  <Download className="size-4" /> {tm("download")}
                </a>
                <button
                  type="button"
                  onClick={() => share(open)}
                  className="sticker inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold"
                >
                  <Share2 className="size-4" /> {tm("share")}
                </button>
                {open.chatId ? (
                  <Link
                    href={`/c/${open.chatId}`}
                    className="sticker inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold"
                  >
                    <MessageSquare className="size-4" /> {t("openChat")}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(open)}
                  className="inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm text-text-3 hover:text-destructive"
                >
                  <Trash2 className="size-4" /> {t("delete")}
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
