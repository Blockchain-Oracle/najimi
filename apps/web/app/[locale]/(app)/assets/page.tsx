import { getTranslations } from "next-intl/server"
import { AssetsGrid } from "@/components/assets/assets-grid"

export default async function AssetsPage() {
  const t = await getTranslations("Assets")
  return (
    <div className="flex flex-col gap-6 px-5 pb-16 md:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="font-title text-title-sm">{t("title")}</h1>
        <p className="text-text-2">{t("hint")}</p>
      </div>
      <AssetsGrid />
    </div>
  )
}
