import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { pageLocale } from "@/lib/page-locale"
import { UploadCheck } from "./upload-check"

/** Checks photo storage end to end: browser resize → server re-encode → private bucket → read back. */
export default async function UploadPage({ params }: PageProps<"/[locale]/system/upload">) {
  if (process.env.NODE_ENV === "production") notFound()
  await pageLocale(params)
  const t = await getTranslations("System")
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="font-title text-title-sm">{t("upload")}</h1>
      <p className="text-text-2">{t("uploadHint")}</p>
      <UploadCheck />
    </main>
  )
}
