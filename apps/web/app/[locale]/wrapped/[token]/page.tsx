import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { StoryViewer } from "@/components/passport/story-viewer"
import { WRAPPED_SLIDES, wrappedOf } from "@/lib/passport"
import { liveShare } from "@/lib/shares"

type Props = {
  params: Promise<{ locale: string; token: string }>
  searchParams: Promise<{ s?: string }>
}

async function wrappedFor(token: string) {
  const share = await liveShare(token)
  if (share?.kind !== "wrapped") return null
  return wrappedOf(share.refId, new Date(share.createdAt).getUTCFullYear())
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const w = await wrappedFor(token)
  if (!w) return { robots: { index: false } }
  const title = `${w.name}'s ${w.year} in taste`
  const description = w.words.slice(0, 4).join(" · ")
  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      title,
      description,
      images: [{ url: `/api/og/wrapped/${token}/og`, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description },
  }
}

async function Story({ params, searchParams }: Props) {
  const [{ token }, { s }] = await Promise.all([params, searchParams])
  if (!(await wrappedFor(token))) notFound()
  return <StoryViewer token={token} slides={WRAPPED_SLIDES} start={Number(s) || 1} />
}

/** A shared Wrapped, played like a story; anyone with the link can watch it. */
export default function WrappedPage(props: Props) {
  return (
    <main className="min-h-dvh bg-black">
      <Suspense fallback={null}>
        <Story {...props} />
      </Suspense>
    </main>
  )
}
