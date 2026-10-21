"use client"

import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { Link2 } from "lucide-react"
import { useTranslations } from "next-intl"

/** Copies a workflow's public link (/w/<slug>): anyone can open it, and newcomers start there. */
export function CopyLinkButton({ slug, className }: { slug: string; className?: string }) {
  const t = useTranslations("Workflows")
  return (
    <button
      type="button"
      aria-label={t("copyLink")}
      title={t("copyLink")}
      onClick={async () => {
        const link = new URL(`/w/${slug}`, window.location.origin).toString()
        await navigator.clipboard.writeText(link).catch(() => undefined)
        toast(t("linkCopied"), { description: link })
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full bg-black/15 text-black backdrop-blur-sm transition-colors hover:bg-black/25",
        className,
      )}
    >
      <Link2 className="size-4" />
    </button>
  )
}
