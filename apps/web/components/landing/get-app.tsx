"use client"

import { X } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { QrCode } from "@/components/brands/qr-code"

const HIDDEN = "najimi:get-app:hidden"

/**
 * Najimi on your phone: a small card in the landing's bottom-right corner (desktop) with a QR
 * code to /download. Closing it keeps it closed on this browser.
 */
export function GetApp() {
  const t = useTranslations("Download")
  const still = useReducedMotion()
  const [url, setUrl] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let hidden = false
    try {
      hidden = window.localStorage.getItem(HIDDEN) === "1"
    } catch {}
    setUrl(`${window.location.origin}/download`)
    if (hidden) return
    const timer = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  const close = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(HIDDEN, "1")
    } catch {}
  }

  return (
    <AnimatePresence>
      {open && url ? (
        <motion.aside
          initial={still ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed end-6 bottom-6 z-40 hidden w-[17.5rem] rounded-[26px] bg-card/90 p-3 shadow-float ring-1 ring-white/10 backdrop-blur-xl md:block"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t("close")}
            className="absolute end-2 top-2 grid size-7 place-items-center rounded-full text-text-3 transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
          <Link href="/download" className="flex items-center gap-3">
            <span className="shrink-0 overflow-hidden rounded-[14px] p-1.5 ring-1 ring-white/10 bg-white">
              <QrCode value={url} label={t("qr")} className="size-[88px]" />
            </span>
            <span className="flex min-w-0 flex-col gap-1 pe-4">
              <span className="font-title text-[17px] leading-tight">{t("cardTitle")}</span>
              <span className="text-[12px] text-text-3">{t("cardLine")}</span>
            </span>
          </Link>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
