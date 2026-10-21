import { getTranslations } from "next-intl/server"
import { LanguageMenu } from "@/components/language-menu"

/** Settings (T21): language now; mode, allowance and "delete all my data" arrive in S06. */
export default async function SettingsPage() {
  const t = await getTranslations("Settings")
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5 pb-16 md:px-0">
      <h1 className="font-title text-title-sm">{t("title")}</h1>
      <section className="flex items-center justify-between rounded-card bg-card p-5 text-card-foreground shadow-paper">
        <span className="font-semibold">{t("language")}</span>
        <LanguageMenu />
      </section>
      <p className="text-sm text-text-3">{t("comingSoon")}</p>
    </div>
  )
}
