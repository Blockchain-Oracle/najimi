import { roundView } from "@najimi/games/round"
import { Orb } from "@najimi/ui/components/orb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { GamePlayer } from "@/components/games/game-player"
import { currentPlayer } from "@/lib/game-player"

type Props = PageProps<"/[locale]/play/[token]">

const valid = (token: string) => /^[a-z0-9]{8,32}$/.test(token)

/** A challenge link's preview: the game, whose taste, and the round's picture. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  if (!valid(token)) return { robots: { index: false } }
  const view = await roundView(token, null)
  if (!view) return { robots: { index: false } }
  const t = await getTranslations("Games")
  const title =
    view.subject && view.kind !== "blind" && view.kind !== "twins"
      ? `${view.title} · ${view.subject.name}`
      : view.title
  const description = t("challenge")
  const images = [{ url: `/api/og/play/${token}`, width: 1200, height: 630 }]
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  }
}

async function Round({ params }: Pick<Props, "params">) {
  const { token } = await params
  if (!valid(token)) notFound()
  const view = await roundView(token, await currentPlayer())
  if (!view) notFound()
  return <GamePlayer initial={view} />
}

/** A game round: anyone with the link can play, no account needed. */
export default function PlayPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <main className="dark grid min-h-dvh place-items-center bg-background">
          <Orb size={96} working />
        </main>
      }
    >
      <Round params={params} />
    </Suspense>
  )
}
