import type { Metadata } from "next"
import { PitchDeck } from "@/components/pitch/pitch-deck"
import { pageLocale } from "@/lib/page-locale"

export const metadata: Metadata = {
  title: "Pitch",
  description:
    "Najimi in five slides: the problem, the product, how Qloo powers it, and what's next.",
  openGraph: { images: ["/demo/cover.png"] },
}

/** /pitch: the pitch deck, full screen (arrow keys, space or the dots to move). */
export default async function PitchPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return <PitchDeck />
}
