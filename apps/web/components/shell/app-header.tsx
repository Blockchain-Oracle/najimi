"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { MessageCircle, Settings2, UserRound } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Suspense, useState } from "react"
import { SignInSheet } from "@/components/auth/sign-in-sheet"
import { LanguageMenu } from "@/components/language-menu"
import { authClient } from "@/lib/auth-client"

/** `match` is the path prefix that lights the item up (your taste page lives at /people/[id]). */
const NAV = [
  { href: "/c", match: "/c", key: "chat", icon: MessageCircle },
  { href: "/me", match: "/people", key: "me", icon: UserRound },
] as const

/** Where you can go, as words in the header row; where you are is in ink. */
function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav")
  return NAV.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      aria-current={pathname?.startsWith(item.match) ? "page" : undefined}
      className={cn(
        "shrink-0 rounded-tile px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
        pathname?.startsWith(item.match) ? "text-foreground" : "text-text-3 hover:text-foreground",
      )}
    >
      {t(item.key)}
    </Link>
  ))
}

/** On a phone, the same places as a tab bar along the bottom edge, where a thumb is. */
function TabLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav")
  return NAV.map((item) => {
    const here = pathname?.startsWith(item.match)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={here ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          here ? "text-foreground" : "text-text-3",
        )}
      >
        <Icon className="size-5" strokeWidth={here ? 2 : 1.5} />
        {t(item.key)}
      </Link>
    )
  })
}

/** The URL is runtime data: the lit-up nav streams in, the plain one is the static shell. */
function CurrentNav() {
  return <NavLinks pathname={usePathname()} />
}
function CurrentTabs() {
  return <TabLinks pathname={usePathname()} />
}

function Nav({ className }: { className?: string }) {
  return (
    <nav className={className}>
      <Suspense fallback={<NavLinks pathname={null} />}>
        <CurrentNav />
      </Suspense>
    </nav>
  )
}

/** Outside the header on purpose: its backdrop blur would make it the fixed bar's container. */
function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      <div className="grid h-14 grid-cols-2">
        <Suspense fallback={<TabLinks pathname={null} />}>
          <CurrentTabs />
        </Suspense>
      </div>
    </nav>
  )
}

/** The shell every app page shares: the wordmark, where you can go, language, and who you are. */
export function AppHeader({ google, email }: { google: boolean; email: boolean }) {
  const t = useTranslations("Nav")
  const ta = useTranslations("Auth")
  const router = useRouter()
  const session = authClient.useSession()
  const [signIn, setSignIn] = useState(false)
  const user = session.data?.user
  const isGuest = !user || (user as { isAnonymous?: boolean | null }).isAnonymous

  return (
    <>
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
          <Link href="/" className="font-title text-[22px]">
            najimi
          </Link>
          <Nav className="flex min-w-0 flex-1 items-center gap-0.5 ps-4 max-sm:hidden" />
          <span className="flex-1 sm:hidden" />
          <div className="hidden sm:block">
            <LanguageMenu />
          </div>
          <Link
            href="/settings"
            aria-label={t("settings")}
            title={t("settings")}
            className="grid size-9 place-items-center rounded-full text-text-2 transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Settings2 className="size-5" />
          </Link>
          {isGuest ? (
            <button
              type="button"
              onClick={() => setSignIn(true)}
              className="rounded-pill px-3.5 py-1.5 text-sm font-medium shadow-sticker transition-colors hover:bg-white/4"
            >
              {t("signIn")}
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger className="grid size-9 place-items-center rounded-full bg-raised text-sm font-medium shadow-sticker">
                {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {ta("signedInAs", { email: user?.email ?? "" })}
                </p>
                <DropdownMenuItem onClick={() => router.push("/settings")}>
                  {t("settings")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await authClient.signOut()
                    router.push("/")
                    router.refresh()
                  }}
                >
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <SignInSheet open={signIn} onOpenChange={setSignIn} google={google} email={email} />
      </header>
      <TabBar />
    </>
  )
}
