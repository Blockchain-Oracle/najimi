"use client"

import { cn } from "@najimi/ui/lib/utils"
import { Check, Download, Share, SquarePlus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { siAndroid, siApple } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { QrCode } from "@/components/brands/qr-code"
import { install, installPrompt, isIos, isStandalone } from "@/lib/push-client"

type Where = "loading" | "installed" | "ios" | "prompt" | "phone" | "desktop"

/**
 * Najimi on your phone (W24): the iPhone and Android apps are a milestone, so they say "coming
 * soon"; what works today is the web app on your Home Screen (with push), shown the way this
 * browser does it.
 */
export function DownloadView() {
  const t = useTranslations("Download")
  const [where, setWhere] = useState<Where>("loading")
  const [url, setUrl] = useState("")

  useEffect(() => {
    setUrl(`${window.location.origin}/download`)
    const read = (): Where =>
      isStandalone()
        ? "installed"
        : isIos()
          ? "ios"
          : installPrompt()
            ? "prompt"
            : window.matchMedia("(pointer: coarse)").matches
              ? "phone"
              : "desktop"
    setWhere(read())
    const ready = () => setWhere(read())
    window.addEventListener("najimi:installable", ready)
    return () => window.removeEventListener("najimi:installable", ready)
  }, [])

  return (
    <main className="dark relative isolate min-h-dvh overflow-hidden bg-background text-foreground">
      <span
        aria-hidden
        className="absolute top-[-20%] left-1/2 -z-10 size-[110vmin] -translate-x-1/2 rounded-full opacity-35 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-aura-2) 0%, var(--color-aura-1) 40%, transparent 70%)",
        }}
      />
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link href="/" className="font-title text-[22px]">
          najimi
        </Link>
        <Link
          href="/feed"
          className="rounded-pill bg-foreground px-4 py-2 text-[14px] font-semibold text-background"
        >
          {t("open")}
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-6 pt-10 pb-24 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="max-w-[14ch] font-title text-[2.6rem] leading-[1.02] md:text-[4rem]">
            {t("title")}
          </h1>
          <p className="max-w-md text-[16px] text-text-2">{t("line")}</p>
        </div>

        <div className="grid w-full max-w-4xl gap-4 md:grid-cols-3">
          {[
            { key: "ios", icon: siApple, name: t("iphone") },
            { key: "android", icon: siAndroid, name: t("android") },
          ].map((p) => (
            <article
              key={p.key}
              className="flex flex-col items-center justify-center gap-3 rounded-[26px] bg-card/80 p-6 ring-1 ring-white/8 backdrop-blur"
            >
              <BrandIcon icon={p.icon} className="size-9" />
              <span className="font-heading text-[18px]">{p.name}</span>
              <span className="rounded-pill bg-white/8 px-3 py-1 text-[12px] font-semibold text-text-2">
                {t("soon")}
              </span>
            </article>
          ))}

          {/* What works now leads on a phone; on a computer it closes the row. */}
          <article className="order-first flex flex-col items-center gap-3 rounded-[26px] bg-card p-6 ring-1 ring-[var(--color-aura-1)]/40 md:order-last">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--color-aura-1)]/15 text-[var(--color-aura-1)]">
              <Download className="size-5" />
            </span>
            <span className="font-heading text-[18px]">{t("today")}</span>
            <TodayHow where={where} url={url} />
          </article>
        </div>
      </section>
    </main>
  )
}

function TodayHow({ where, url }: { where: Where; url: string }) {
  const t = useTranslations("Download")
  const [done, setDone] = useState(false)
  if (where === "loading") return <span className="h-16" />
  if (where === "installed" || done)
    return (
      <span className="flex items-center gap-1.5 text-[14px] font-semibold text-text-2">
        <Check className="size-4" /> {t("installed")}
      </span>
    )
  if (where === "ios")
    return (
      <ol className="flex flex-col gap-2 text-start text-[14px] text-text-2">
        <li className="flex items-center gap-2">
          <Share className="size-4 shrink-0" /> {t("iosStep1")}
        </li>
        <li className="flex items-center gap-2">
          <SquarePlus className="size-4 shrink-0" /> {t("iosStep2")}
        </li>
      </ol>
    )
  if (where === "prompt")
    return (
      <button
        type="button"
        onClick={() => void install().then((ok) => ok && setDone(true))}
        className="flex h-11 items-center gap-2 rounded-pill bg-foreground px-5 text-[15px] font-semibold text-background"
      >
        <Download className="size-4" /> {t("install")}
      </button>
    )
  if (where === "phone") return <span className="text-[14px] text-text-2">{t("menuInstall")}</span>
  // A computer: point the phone at it.
  return (
    <span className="flex flex-col items-center gap-2">
      <span className={cn("rounded-[14px] bg-white p-1.5")}>
        {url ? <QrCode value={url} label={t("qr")} className="size-24" /> : null}
      </span>
      <span className="text-[13px] text-text-3">{t("scan")}</span>
    </span>
  )
}
