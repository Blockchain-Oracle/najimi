import type { Metadata } from "next"
import { DownloadView } from "@/components/download/download-view"
import { pageLocale } from "@/lib/page-locale"

export const metadata: Metadata = {
  title: "Najimi on your phone",
  description: "Add Najimi to your Home Screen today. The iPhone and Android apps are coming.",
}

/** /download: Najimi on your phone (apps coming; the Home Screen app today). */
export default async function DownloadPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <DownloadView />
}
