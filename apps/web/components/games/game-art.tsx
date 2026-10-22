"use client"

import { cn } from "@najimi/ui/lib/utils"
import { Face } from "@/components/taste/face"
import { WavelengthDial } from "./wavelength-dial"

/*
 * Each game's little picture, drawn from real taste (your loves' artwork, the room's faces): the
 * wavelength's dial, Blind Taste's face-down deck, the four tiles of "which did they pick?", and
 * the faces of Taste twins. Used on the People tiles and the room's game sheet.
 */

export type GameKind = "wavelength" | "knowme" | "twins" | "blind"

const sized = (url: string | null | undefined, width: number) =>
  url?.includes("images.qloo.com") ? url.replace(/-\d+x-auto\./, `-${width}x-auto.`) : (url ?? null)

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span className={cn("block overflow-hidden bg-white/10 ring-1 ring-white/15", className)}>
      {src ? (
        // biome-ignore lint/performance/noImgElement: remote artwork thumbnail
        <img src={sized(src, 160) ?? ""} alt="" className="size-full object-cover" />
      ) : null}
    </span>
  )
}

export function GameArt({
  kind,
  art,
  faces = [],
  label,
}: {
  kind: GameKind
  art: string[]
  faces?: { name: string; look: string | null }[]
  /** The dial's accessible name. */
  label: string
}) {
  const a = (i: number) => art[i % Math.max(art.length, 1)] ?? null
  if (kind === "wavelength")
    return (
      <span className="w-32">
        <WavelengthDial value={72} low="" high="" label={label} />
      </span>
    )
  if (kind === "blind")
    return (
      <span className="relative h-24 w-[4.5rem]">
        {[2, 1, 0].map((i) => (
          <span
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${(i - 1) * 9}deg) translateX(${(i - 1) * 10}px)` }}
          >
            <Thumb
              src={a(i + 1)}
              className={cn("size-full rounded-tile shadow-float", i === 0 && "[&_img]:blur-[6px]")}
            />
            {i === 0 ? (
              <span className="absolute inset-0 grid place-items-center font-title text-[28px] text-white">
                ?
              </span>
            ) : null}
          </span>
        ))}
      </span>
    )
  if (kind === "knowme")
    return (
      <span className="grid grid-cols-2 gap-1.5">
        {[3, 4, 5, 6].map((i, k) => (
          <Thumb
            key={i}
            src={a(i)}
            className={cn("size-11 rounded-[10px]", k === 1 && "ring-2 ring-success")}
          />
        ))}
      </span>
    )
  return (
    <span className="relative flex items-center">
      {(faces.length
        ? faces
        : [
            { name: "?", look: null },
            { name: "?", look: null },
          ]
      )
        .slice(0, 3)
        .map((f, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
            key={i}
            className="-ms-4 rounded-full ring-4 ring-[#0b0b0d] first:ms-0"
            style={{ transform: `translateY(${i % 2 ? 8 : -4}px)` }}
          >
            <Face look={f.look} name={f.name} size="lg" />
          </span>
        ))}
      <span className="absolute -top-3 -end-3 grid size-8 place-items-center rounded-full bg-signal font-title text-[16px] text-signal-foreground">
        ?
      </span>
    </span>
  )
}

/** A game tile: its picture over a wash of real artwork, name and one line. */
export function GameTile({
  title,
  line,
  wash,
  busy,
  selected,
  onClick,
  className,
  children,
}: {
  title: string
  line: string
  wash: string | null
  busy?: boolean
  selected?: boolean
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={selected}
      className={cn(
        "dark relative isolate flex flex-col justify-between overflow-hidden rounded-card bg-[#0b0b0d] p-3.5 text-start text-white ring-1 ring-white/10 transition-[transform,box-shadow] active:scale-[0.97]",
        selected && "ring-2 ring-signal",
        className,
      )}
    >
      {wash ? (
        // biome-ignore lint/performance/noImgElement: remote artwork, blurred as the tile's colour
        <img
          src={sized(wash, 160) ?? wash}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 size-full scale-150 object-cover opacity-55 blur-2xl saturate-150"
        />
      ) : null}
      <span className="flex h-28 items-center justify-center">{children}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-heading text-[15px] leading-tight">{title}</span>
        <span className="text-[12px] leading-snug text-white/65">{line}</span>
      </span>
      {busy ? (
        <span className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm">
          <span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </span>
      ) : null}
    </button>
  )
}
