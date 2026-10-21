"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Artwork, shapeOf } from "@/components/artwork"

/** A picked love as a sticker: its artwork, its name, a way to take it back. */
export function LovePill({
  name,
  image,
  type,
  onRemove,
}: {
  name: string
  image: string | null
  type: string
  onRemove?: () => void
}) {
  const t = useTranslations("Loves")
  return (
    <span className="sticker inline-flex max-w-full animate-card-land items-center gap-2 py-1 ps-1 pe-2 text-sm font-semibold">
      <Artwork
        src={image}
        name={name}
        shape={shapeOf(type) === "place" ? "square" : "square"}
        className="size-7 shrink-0 rounded-full"
      />
      <span className="truncate">{name}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("remove", { name })}
          className="grid size-6 place-items-center rounded-full hover:bg-white/15"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  )
}
