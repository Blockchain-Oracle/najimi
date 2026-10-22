import Link from "next/link"
import type { ReactNode } from "react"

/** Someone's profile when they have one (a username); otherwise the same content, not a fake link. */
export function ProfileLink({
  username,
  className,
  children,
}: {
  username: string | null | undefined
  className?: string
  children: ReactNode
}) {
  if (!username) return <span className={className}>{children}</span>
  return (
    <Link href={`/u/${username}`} className={className}>
      {children}
    </Link>
  )
}
