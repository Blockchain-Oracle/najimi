import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { siInstagram, siTiktok, siX, siYoutube } from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"

/*
 * Connecting X, Instagram, TikTok and YouTube is a milestone, not a feature yet: this page says so
 * plainly, says what reads your taste today, and sends you back to it. (SOCIAL.connectSoon)
 */
export async function ComingSoon({
  kind,
  personId,
}: {
  /** Your feeds, or the agents that act on them. */
  kind: "feeds" | "agents"
  personId: string | null
}) {
  const t = await getTranslations("Soon")
  return (
    <section className="relative flex flex-col items-center gap-6 overflow-hidden rounded-card bg-card px-6 py-10 text-center ring-1 ring-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--color-aura-2) 22%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex items-center gap-3">
        {[siX, siInstagram, siTiktok, siYoutube].map((icon) => (
          <span
            key={icon.slug}
            className="grid size-14 place-items-center rounded-[18px] bg-background ring-1 ring-border"
          >
            <BrandIcon
              icon={icon}
              colored={icon.slug !== "x" && icon.slug !== "tiktok"}
              className="size-6"
            />
          </span>
        ))}
      </div>
      <div className="relative flex max-w-md flex-col gap-2">
        <span className="mx-auto rounded-pill bg-secondary px-3 py-1 text-[12px] font-bold tracking-[0.08em] uppercase">
          {t("badge")}
        </span>
        <h2 className="font-title text-[1.9rem] leading-tight">{t(`${kind}.title`)}</h2>
        <p className="text-[15px] leading-relaxed text-text-2">{t(`${kind}.body`)}</p>
      </div>
      <div className="relative w-full max-w-md rounded-tile bg-background p-4 text-start ring-1 ring-border">
        <p className="text-[12px] font-bold tracking-[0.08em] text-text-3 uppercase">
          {t("today")}
        </p>
        <p className="pt-1.5 text-[15px] leading-relaxed">{t("todayBody")}</p>
      </div>
      {personId ? (
        <Link
          href={`/people/${personId}`}
          className="relative inline-flex h-11 items-center rounded-pill bg-foreground px-5 font-semibold text-background"
        >
          {t("back")}
        </Link>
      ) : null}
    </section>
  )
}
