import { LEGAL } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import Link from "next/link"
import type { ReactNode } from "react"

/*
 * The privacy policy and the terms: one readable column in the app's own look, the date they last
 * changed, and the way back.
 */

export function LegalPage({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: ReactNode
}) {
  const updated = new Date(`${LEGAL.updated}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-5 py-12 md:py-16">
        <Link href="/" className="flex w-fit items-center gap-2 font-heading text-[17px]">
          <Orb size={28} /> Najimi
        </Link>
        <header className="flex flex-col gap-3">
          <h1 className="font-title text-[2.6rem] leading-none">{title}</h1>
          <p className="text-[17px] leading-relaxed text-text-2">{lead}</p>
          <p className="text-[13px] text-text-3">Last updated {updated}</p>
        </header>
        <div className="flex flex-col gap-9">{children}</div>
        <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-[14px] text-text-3">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
          <a href={`mailto:${LEGAL.contact}`} className="hover:text-foreground">
            {LEGAL.contact}
          </a>
        </footer>
      </div>
    </main>
  )
}

export function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 text-[15.5px] leading-relaxed text-text-2 [&_strong]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:ps-5">
      <h2 className="font-heading text-[20px] text-foreground">{title}</h2>
      {children}
    </section>
  )
}

/** Who gets what: a two-column table that stays readable on a phone. */
export function Who({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col divide-y divide-border overflow-hidden rounded-card bg-card ring-1 ring-border">
      {rows.map(([name, what]) => (
        <div key={name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
          <dt className="shrink-0 font-semibold text-foreground sm:w-44">{name}</dt>
          <dd className="text-[14.5px]">{what}</dd>
        </div>
      ))}
    </dl>
  )
}
