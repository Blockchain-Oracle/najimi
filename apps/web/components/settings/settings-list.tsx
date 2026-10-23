"use client"

import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { cn } from "@najimi/ui/lib/utils"
import {
  Ban,
  Bell,
  Bot,
  ChevronRight,
  Eye,
  FileText,
  Gauge,
  Link2,
  type LucideIcon,
  Rss,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { type ReactNode, useState } from "react"

/*
 * Settings as grouped one-line rows: a label, where it stands now, and the way in. Detail lives in
 * a sheet (or its own page), so a whole group fits one phone screen.
 */

const ICONS = {
  profile: UserRound,
  privacy: Eye,
  mode: Sparkles,
  agents: Bot,
  notifications: Bell,
  feeds: Rss,
  links: Link2,
  blocked: Ban,
  today: Gauge,
  account: ShieldCheck,
  legal: FileText,
  delete: Trash2,
} satisfies Record<string, LucideIcon>

export type SettingsRow = {
  id: string
  icon: keyof typeof ICONS
  label: string
  /** Where it stands now ("Everyone", "3", "On"). */
  value?: string | null
  /** A page to open, or a sheet with the detail. */
  href?: string
  sheet?: { title: string; hint?: string; body: ReactNode }
  danger?: boolean
}

function RowBody({ row }: { row: SettingsRow }) {
  const Icon = ICONS[row.icon]
  return (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-tile",
          row.danger ? "bg-destructive/15 text-destructive" : "bg-secondary text-text-2",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className={cn("flex-1 text-[15px] font-semibold", row.danger && "text-destructive")}>
        {row.label}
      </span>
      {row.value ? (
        <span className="max-w-[45%] truncate text-[14px] text-text-3">{row.value}</span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-text-3" />
    </>
  )
}

const rowClass =
  "flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-white/4"

export function SettingsGroup({
  title,
  rows,
  children,
}: {
  title?: string
  rows?: SettingsRow[]
  /** Rows that bring their own control (the language sheet). */
  children?: ReactNode
}) {
  const [open, setOpen] = useState<string | null>(null)
  const shown = rows?.find((r) => r.id === open)?.sheet
  return (
    <section className="flex flex-col gap-2">
      {title ? <h2 className="px-1 text-[13px] font-semibold text-text-3">{title}</h2> : null}
      <div className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
        {children}
        {rows?.map((row) =>
          row.href ? (
            <Link key={row.id} href={row.href} className={rowClass}>
              <RowBody row={row} />
            </Link>
          ) : (
            <button key={row.id} type="button" onClick={() => setOpen(row.id)} className={rowClass}>
              <RowBody row={row} />
            </button>
          ),
        )}
      </div>
      <Sheet open={Boolean(shown)} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[88svh] max-w-lg flex-col gap-4 overflow-y-auto rounded-t-sheet border-0 bg-card px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
        >
          {shown ? (
            <>
              <div className="flex flex-col gap-1">
                <SheetTitle className="font-title text-[1.6rem] font-normal">
                  {shown.title}
                </SheetTitle>
                {shown.hint ? <p className="text-[14px] text-text-3">{shown.hint}</p> : null}
              </div>
              {shown.body}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}

/** The person at the top: face, name, handle; a tap opens the profile sheet. */
export function ProfileRow({
  face,
  name,
  handle,
  sheet,
}: {
  face: ReactNode
  name: string
  handle: string | null
  sheet: { title: string; body: ReactNode }
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3.5 rounded-card bg-card p-4 text-start ring-1 ring-border transition-colors hover:bg-white/4"
      >
        {face}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-heading text-[18px]">{name}</span>
          {handle ? <span className="text-[13px] text-text-3">@{handle}</span> : null}
        </span>
        <ChevronRight className="size-4 text-text-3" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="mx-auto flex max-h-[88svh] max-w-lg flex-col gap-4 overflow-y-auto rounded-t-sheet border-0 bg-card px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
        >
          <SheetTitle className="font-title text-[1.6rem] font-normal">{sheet.title}</SheetTitle>
          {sheet.body}
        </SheetContent>
      </Sheet>
    </>
  )
}
