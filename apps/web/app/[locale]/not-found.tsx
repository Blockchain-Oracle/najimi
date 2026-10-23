import { APP } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import Link from "next/link"

/** A page that isn't there: Najimi's orb, one line, and the way back. */
export default function NotFound() {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(40% 32% at 50% 38%, color-mix(in oklab, var(--color-aura-1) 22%, transparent), transparent 70%)",
        }}
      />
      <Orb size={88} />
      <div className="flex flex-col gap-2">
        <p className="tnum text-[13px] font-bold tracking-[0.12em] text-text-3 uppercase">404</p>
        <h1 className="font-title text-[2rem] leading-tight">This page isn't here.</h1>
        <p className="text-[15px] text-text-2">It may have moved, or the link is old.</p>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-pill bg-foreground px-5 font-semibold text-background"
        >
          Home
        </Link>
        <Link
          href="/feed"
          className="inline-flex h-11 items-center rounded-pill bg-card px-5 font-semibold ring-1 ring-border"
        >
          Your feed
        </Link>
        {APP.docs ? (
          <a
            href={APP.docs}
            className="inline-flex h-11 items-center rounded-pill bg-card px-5 font-semibold ring-1 ring-border"
          >
            Docs
          </a>
        ) : null}
      </nav>
    </main>
  )
}
