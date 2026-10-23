"use client"

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@najimi/ui/components/input-otp"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { siTiktok } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { authClient } from "@/lib/auth-client"

/**
 * Sign in to keep a guest's taste: Google or TikTok when they're set up on this server, or a
 * six-digit code by email. A guest who signs in keeps everything, even into an account that
 * already exists.
 */

export type SignInWays = { google: boolean; tiktok: boolean; email: boolean }

/** Google's own four-colour G, as its sign-in guidelines ask. */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

const pill =
  "flex h-12 w-full items-center justify-center gap-2.5 rounded-pill font-heading text-[15px] transition-opacity disabled:opacity-60"

export function SignInSheet({
  open,
  onOpenChange,
  ways,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ways: SignInWays
}) {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState<"google" | "tiktok" | "email" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function social(provider: "google" | "tiktok") {
    setBusy(provider)
    setError(null)
    const r = await authClient.signIn.social({ provider, callbackURL: window.location.pathname })
    if (r.error) {
      setBusy(null)
      setError(r.error.message ?? "")
    }
  }

  async function send() {
    setBusy("email")
    setError(null)
    const r = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    })
    setBusy(null)
    if (r.error) setError(r.error.message ?? "")
    else setSent(true)
  }

  async function verify(otp: string) {
    setBusy("email")
    setError(null)
    const r = await authClient.signIn.emailOtp({ email: email.trim(), otp })
    setBusy(null)
    if (r.error) {
      setError(r.error.message ?? "")
      setCode("")
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  const socials = ways.google || ways.tiktok

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex max-w-md flex-col gap-4 rounded-t-sheet border-0 bg-card px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-foreground"
      >
        <div className="flex flex-col gap-1.5">
          <SheetTitle className="font-title text-[1.8rem] font-normal leading-tight">
            {t("title")}
          </SheetTitle>
          <p className="text-[15px] text-text-2">{t("hint")}</p>
        </div>
        {ways.google ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void social("google")}
            className={`${pill} bg-white text-[#1f1f1f] ring-1 ring-black/10`}
          >
            {busy === "google" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <GoogleG className="size-5" />
            )}
            {t("google")}
          </button>
        ) : null}
        {ways.tiktok ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void social("tiktok")}
            className={`${pill} bg-black text-white ring-1 ring-white/15`}
          >
            {busy === "tiktok" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <BrandIcon icon={siTiktok} className="size-[18px]" />
            )}
            {t("tiktok")}
          </button>
        ) : null}
        {socials && ways.email ? (
          <div className="flex items-center gap-3 text-[12px] font-semibold text-text-3">
            <span className="h-px flex-1 bg-border" />
            {t("or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        ) : null}
        {ways.email ? (
          sent ? (
            <div className="flex flex-col gap-3">
              <p className="text-[14px] text-text-2">{t("codeSent", { email: email.trim() })}</p>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v)
                  if (v.length === 6) void verify(v)
                }}
                disabled={busy !== null}
                autoFocus
              >
                <InputOTPGroup dir="ltr">
                  {Array.from({ length: 6 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: one slot per digit, in order
                    <InputOTPSlot key={i} index={i} className="size-11 bg-background text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <button
                type="button"
                className="w-fit text-[13px] text-text-3 underline underline-offset-4"
                onClick={() => setSent(false)}
              >
                {t("otherEmail")}
              </button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <input
                type="email"
                required
                aria-label={t("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                autoComplete="email"
                className="h-12 rounded-pill bg-background px-4 text-[16px] ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={busy !== null || !email.includes("@")}
                className={`${pill} bg-foreground text-background disabled:opacity-40`}
              >
                {busy === "email" ? <Loader2 className="size-5 animate-spin" /> : null}
                {busy === "email" ? t("sending") : t("sendCode")}
              </button>
            </form>
          )
        ) : null}
        {error ? (
          <p className="text-[13px] text-destructive">{t("failed", { reason: error })}</p>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
