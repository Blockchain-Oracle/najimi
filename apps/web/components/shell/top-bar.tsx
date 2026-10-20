import { APP } from "@najimi/config"
import Link from "next/link"

/** The thin top bar every page shares: the wordmark, and where you are. */
export function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border print:hidden">
      <Link href="/" className="text-sm font-bold uppercase">
        {APP.name}
      </Link>
      <nav className="flex items-center gap-2 text-sm">{children}</nav>
    </header>
  )
}
