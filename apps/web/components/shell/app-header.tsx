"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { cn } from "@najimi/ui/lib/utils"
import { Settings2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Suspense, useState } from "react"
import { SignInSheet } from "@/components/auth/sign-in-sheet"
import { LanguageMenu } from "@/components/language-menu"
import { authClient } from "@/lib/auth-client"

const NAV = [
  { href: "/c", key: "chat" },
  { href: "/people", key: "people" },
  { href: "/workflows", key: "workflows" },
  { href: "/assets", key: "assets" },
] as const

/** Where you can go; `pathname` lights up where you are. */
function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Nav")
  return NAV.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        "rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors",
        pathname?.startsWith(item.href) ? "bg-foreground text-background" : "hover:bg-secondary",
      )}
    >
      {t(item.key)}
    </Link>
  ))
}

/** The URL is runtime data: the lit-up nav streams in, the plain one is the static shell. */
function CurrentNav() {
  return <NavLinks pathname={usePathname()} />
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
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
        <Link href="/" className="font-title text-xl">
          najimi
        </Link>
        <nav className="flex flex-1 items-center gap-1 ps-3">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <CurrentNav />
          </Suspense>
        </nav>
        <div className="hidden sm:block">
          <LanguageMenu />
        </div>
        {isGuest ? (
          <>
            <Link
              href="/settings"
              aria-label={t("settings")}
              title={t("settings")}
              className="grid size-9 place-items-center rounded-full text-text-2 transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Settings2 className="size-5" />
            </Link>
            <button
              type="button"
              onClick={() => setSignIn(true)}
              className="sticker px-3.5 py-1.5 text-sm font-semibold"
            >
              {t("signIn")}
            </button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-9 place-items-center rounded-full bg-lime font-title text-lime-foreground">
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
  )
}
