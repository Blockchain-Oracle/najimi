"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@najimi/ui/components/dropdown-menu"
import { Orb } from "@najimi/ui/components/orb"
import { cn } from "@najimi/ui/lib/utils"
import { Settings2 } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Suspense, useState } from "react"
import { SignInSheet } from "@/components/auth/sign-in-sheet"
import { LanguageMenu } from "@/components/language-menu"
import { authClient } from "@/lib/auth-client"
import { isHere, NAV } from "./nav"
import { TabBar } from "./tab-bar"

/** The rail's width; layouts pad their content by the same amount on desktop. */
export const RAIL_WIDTH = "md:ps-[5.5rem]"

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("font-title text-[22px] leading-none", className)}>
      najimi
    </Link>
  )
}

/** Sign in for guests; the account menu once signed in. */
function Account({ onSignIn }: { onSignIn: () => void }) {
  const t = useTranslations("Nav")
  const ta = useTranslations("Auth")
  const router = useRouter()
  const session = authClient.useSession()
  const user = session.data?.user
  const isGuest = !user || (user as { isAnonymous?: boolean | null }).isAnonymous
  if (isGuest)
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-pill bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t("signIn")}
      </button>
    )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-10 place-items-center rounded-full bg-card text-sm font-semibold">
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
  )
}

function SettingsLink() {
  const t = useTranslations("Nav")
  return (
    <Link
      href="/settings"
      aria-label={t("settings")}
      title={t("settings")}
      className="grid size-10 place-items-center rounded-full text-text-2 transition-colors hover:bg-card hover:text-foreground"
    >
      <Settings2 className="size-5" />
    </Link>
  )
}

function CurrentRail({ onSignIn }: { onSignIn: () => void }) {
  return <Rail pathname={usePathname()} onSignIn={onSignIn} />
}

/** Desktop: a slim rail on the left with every section, and you at the bottom. */
function Rail({ pathname, onSignIn }: { pathname: string | null; onSignIn: () => void }) {
  const t = useTranslations("Nav")
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-y-0 start-0 z-40 hidden w-[5.5rem] flex-col items-center gap-2 border-e border-border bg-background py-5 md:flex"
    >
      <Wordmark className="mb-4 text-[17px]" />
      {NAV.map((item) => {
        const here = isHere(pathname, item)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={here ? "page" : undefined}
            className={cn(
              "flex w-[4.5rem] flex-col items-center gap-1 rounded-tile py-2.5 text-[11px] font-semibold transition-colors",
              here ? "bg-card text-foreground" : "text-text-3 hover:text-foreground",
            )}
          >
            {Icon === "orb" ? (
              <Orb size={30} />
            ) : (
              <Icon className="size-6" strokeWidth={here ? 2.2 : 1.8} />
            )}
            {t(item.key)}
          </Link>
        )
      })}
      <div className="mt-auto flex flex-col items-center gap-2">
        <LanguageMenu compact />
        <SettingsLink />
        <Account onSignIn={onSignIn} />
      </div>
    </nav>
  )
}

/**
 * The shell every app page shares. Phones: a light top bar (the wordmark, settings and you) and the
 * floating tab bar. Desktop: the rail. Content pads by RAIL_WIDTH on desktop.
 */
export function AppHeader({ google, email }: { google: boolean; email: boolean }) {
  const [signIn, setSignIn] = useState(false)
  return (
    <>
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-center gap-2 px-4">
          <Wordmark />
          <span className="flex-1" />
          <SettingsLink />
          <Account onSignIn={() => setSignIn(true)} />
        </div>
      </header>
      {/* The URL is runtime data: the lit-up rail streams in, the plain one is the static shell. */}
      <Suspense fallback={<Rail pathname={null} onSignIn={() => setSignIn(true)} />}>
        <CurrentRail onSignIn={() => setSignIn(true)} />
      </Suspense>
      <TabBar />
      <SignInSheet open={signIn} onOpenChange={setSignIn} google={google} email={email} />
    </>
  )
}
