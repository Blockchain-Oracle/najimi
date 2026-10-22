import { Orb } from "@najimi/ui/components/orb"
import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { PlanView } from "@/components/business/plan-view"
import { sharedBusiness } from "@/lib/business"

type Props = { params: Promise<{ locale: string; token: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await sharedBusiness((await params).token)
  if (!b?.report) return { robots: { index: false } }
  const description = b.report.plan?.summary ?? `${b.name}, ${b.kind}`
  return {
    title: `${b.name} · plan`,
    description,
    robots: { index: false },
    openGraph: { title: `${b.name} · plan`, description },
  }
}

async function Shared({ params }: Pick<Props, "params">) {
  const b = await sharedBusiness((await params).token)
  if (!b?.report) notFound()
  const t = await getTranslations("Business")
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-5 pb-16 md:px-0 md:pt-6">
      <PlanView
        business={{
          name: b.name,
          kind: b.kind,
          city: b.city,
          lat: b.lat,
          lon: b.lon,
          report: b.report,
        }}
      />
      <Link
        href="/business"
        className="flex h-12 items-center justify-center gap-2 rounded-pill bg-foreground font-heading text-[15px] text-background"
      >
        {t("yourOwn")} <ArrowRight className="size-4" />
      </Link>
    </div>
  )
}

/** A business's plan, shared by its owner: anyone with the link can read it. */
export default function SharedBusinessPage({ params }: Props) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <Suspense
        fallback={
          <div className="grid min-h-dvh place-items-center">
            <Orb size={88} working />
          </div>
        }
      >
        <Shared params={params} />
      </Suspense>
    </main>
  )
}
