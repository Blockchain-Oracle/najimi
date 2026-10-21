"use client"

import { Button } from "@najimi/ui/components/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@najimi/ui/components/input-otp"
import { Sheet, SheetContent, SheetTitle } from "@najimi/ui/components/sheet"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

/**
 * Sign in to keep a guest's taste (rule 9): Google when it's set up, or a six-digit code by
 * email. A guest who signs in keeps everything, even into an account that already exists.
 */
export function SignInSheet({
  open,
  onOpenChange,
  google,
  email: emailEnabled,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  google: boolean
  email: boolean
}) {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setBusy(true)
    setError(null)
    const r = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    })
    setBusy(false)
    if (r.error) setError(r.error.message ?? "")
    else setSent(true)
  }

  async function verify(otp: string) {
    setBusy(true)
    setError(null)
    const r = await authClient.signIn.emailOtp({ email: email.trim(), otp })
    setBusy(false)
    if (r.error) {
      setError(r.error.message ?? "")
      setCode("")
      return
    }
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-sheet border-0 bg-card px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-card-foreground"
      >
        <SheetTitle className="font-title text-2xl text-card-foreground">{t("title")}</SheetTitle>
        <p className="text-paper-muted">{t("hint")}</p>
        {google ? (
          <Button
            variant="sticker"
            size="lg"
            onClick={() =>
              authClient.signIn.social({
                provider: "google",
                callbackURL: window.location.pathname,
              })
            }
          >
            {t("google")}
          </Button>
        ) : null}
        {emailEnabled ? (
          sent ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm">{t("codeSent", { email: email.trim() })}</p>
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v)
                  if (v.length === 6) void verify(v)
                }}
                disabled={busy}
                autoFocus
              >
                <InputOTPGroup dir="ltr">
                  {Array.from({ length: 6 }, (_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: one slot per digit, in order
                    <InputOTPSlot key={i} index={i} className="size-11 bg-paper text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button
                variant="link"
                className="w-fit text-paper-muted"
                onClick={() => setSent(false)}
              >
                {t("otherEmail")}
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault()
                void send()
              }}
            >
              <label className="flex flex-col gap-1.5 text-sm font-semibold">
                {t("email")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  autoComplete="email"
                  className="rounded-pill bg-paper px-4 py-3 font-normal ring-1 ring-paper-foreground/15 outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <Button type="submit" size="lg" disabled={busy || !email.includes("@")}>
                {busy ? t("sending") : t("sendCode")}
              </Button>
            </form>
          )
        ) : null}
        {error ? (
          <p className="text-sm text-destructive">{t("failed", { reason: error })}</p>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
