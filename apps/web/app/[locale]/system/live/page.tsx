import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { pageLocale } from "@/lib/page-locale"
import { LiveCheck } from "./live-check"

/** Development check of the live pipe (web → queue → worker → NOTIFY → SSE → this page). */
export default async function LivePage({ params }: PageProps<"/[locale]/system/live">) {
  if (process.env.NODE_ENV === "production") notFound()
  await pageLocale(params)
  const t = await getTranslations("System")
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="font-title text-title-sm">{t("livePipe")}</h1>
      <LiveCheck />
    </main>
  )
}
