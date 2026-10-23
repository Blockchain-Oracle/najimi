"use client"

import { Dialog } from "@base-ui/react/dialog"
import { cn } from "@najimi/ui/lib/utils"
import { X } from "lucide-react"
import type { ReactNode } from "react"

/** A dark bottom sheet (a centred card on desktop), like the feed itself: why, more, tune, a pick. */
export function DarkSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  bare = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: ReactNode
  className?: string
  /** No header: the content starts flush at the top (a stage), the close button floats over it. */
  bare?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[88svh] w-full max-w-lg flex-col overflow-hidden rounded-t-sheet bg-[#121214] text-white shadow-float [color-scheme:dark] transition duration-300 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full md:bottom-6 md:rounded-sheet",
            className,
          )}
        >
          {bare ? (
            <>
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <span className="pointer-events-none absolute inset-x-0 top-2.5 z-20 mx-auto h-1 w-10 rounded-full bg-white/40" />
              <Dialog.Close
                aria-label="Close"
                className="absolute top-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-black/60"
              >
                <X className="size-4" />
              </Dialog.Close>
              <div className="overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {children}
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/20" />
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <Dialog.Title className="font-title text-[22px]">{title}</Dialog.Title>
                <Dialog.Close
                  aria-label="Close"
                  className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {children}
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
