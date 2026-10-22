import type { NajimiUIMessage } from "@najimi/agent"
import { db, schema } from "@najimi/db"
import { and, eq, inArray } from "drizzle-orm"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { SharedChat } from "@/components/chat/shared-chat"
import { SharedTaste } from "@/components/taste/shared-taste"
import { uploadIdsOf } from "@/lib/chat/merge"
import { identityOf } from "@/lib/people"
import { liveShare, sharedSubject } from "@/lib/shares"

type Props = PageProps<"/[locale]/s/[token]">

/** A shared chat without the person's own photos: their file parts never reach the page (samples stay). */
async function withoutOwnPhotos(messages: NajimiUIMessage[]): Promise<NajimiUIMessage[]> {
  const ids = [...new Set(messages.flatMap(uploadIdsOf))]
  const samples = ids.length
    ? await db
        .select({ id: schema.uploads.id })
        .from(schema.uploads)
        .where(and(inArray(schema.uploads.id, ids), eq(schema.uploads.sample, true)))
    : []
  const open = new Set(samples.map((s) => s.id))
  return messages.map((m) => ({
    ...m,
    parts: m.parts.filter(
      (p) => p.type !== "file" || uploadIdsOf({ ...m, parts: [p] }).every((id) => open.has(id)),
    ),
  }))
}

/** The title, line and picture a link preview shows (the picture is drawn by /api/og/s). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const share = await liveShare(token)
  const subject = share ? await sharedSubject(share) : null
  if (!subject) return { robots: { index: false } }
  const t = await getTranslations("Share")
  const title =
    subject.kind === "creation"
      ? (subject.creation.title ?? t("creationTitle"))
      : subject.kind === "chat"
        ? (subject.chat.title ?? t("chatTitle"))
        : t("tasteTitle", { name: subject.person.name })
  const description =
    subject.kind === "creation" && subject.creation.words.length
      ? t("madeFrom", { words: subject.creation.words.join(" · ") })
      : subject.kind === "person" && subject.taste?.words
        ? Object.values(subject.taste.words).flat().slice(0, 8).join(" · ")
        : t("pitch")
  // Shared things are for the people they're sent to, not for search engines.
  const images = [{ url: `/api/og/s/${token}`, width: 1200, height: 630 }]
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  }
}

/**
 * What a share link points to (C15, T19): one creation, a whole chat read-only, or a taste card.
 * Never the person's own photos, city or About; revoked links stop at once.
 */
async function Shared({ params }: { params: Props["params"] }) {
  const { token } = await params
  const t = await getTranslations("Share")
  const share = await liveShare(token)
  const subject = share ? await sharedSubject(share) : null
  if (!subject) notFound()

  if (subject.kind === "chat")
    return (
      <>
        <h1 className="font-title text-title-sm">{subject.chat.title ?? t("chatTitle")}</h1>
        <SharedChat
          token={token}
          ready={subject.made.map((c) => c.id)}
          messages={await withoutOwnPhotos(subject.messages)}
        />
      </>
    )

  if (subject.kind === "person") {
    const { person, taste, loves } = subject
    return (
      <SharedTaste
        data={{
          token,
          name: person.name,
          identity: identityOf(person.id, person.look),
          look: person.look,
          loves: [...loves]
            .sort((a, b) => b.weight - a.weight)
            .map((l) => ({ qlooId: l.qlooId, name: l.name, imageUrl: l.imageUrl, type: l.type })),
          words: taste?.words ?? null,
          picks: taste?.picks ?? null,
          bridges: taste?.bridges ?? null,
        }}
      />
    )
  }

  const c = subject.creation
  const src = (id: string, v: string) =>
    `/api/media/creation/${id}?v=${v}&share=${encodeURIComponent(token)}`
  return (
    <figure className="print">
      {c.kind === "video" ? (
        // biome-ignore lint/a11y/useMediaCaption: generated video with no speech
        <video
          src={src(c.id, "original")}
          controls
          playsInline
          className="w-full rounded-sm bg-black"
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: a shared, token-checked creation
        <img src={src(c.id, "display")} alt={c.title ?? ""} className="w-full rounded-sm" />
      )}
      <figcaption className="flex flex-col gap-1 px-1 pt-3 text-paper-foreground">
        <span className="font-heading text-[17px]">{c.title}</span>
        {c.words.length ? (
          <span className="text-sm text-paper-muted">
            {t("madeFrom", { words: c.words.join(" · ") })}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

export default async function SharePage(props: Props) {
  const t = await getTranslations("Share")
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-title text-[22px]">
          najimi
        </Link>
        <Link
          href="/start"
          className="rounded-pill bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground shadow-sticker"
        >
          {t("cta")}
        </Link>
      </header>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-card/10" />}>
        <Shared params={props.params} />
      </Suspense>
      <p className="text-text-2">{t("pitch")}</p>
    </main>
  )
}
