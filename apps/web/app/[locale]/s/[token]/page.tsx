import type { NajimiUIMessage } from "@najimi/agent"
import { db, schema } from "@najimi/db"
import { and, eq, inArray, isNull } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { SharedChat } from "@/components/chat/shared-chat"
import { uploadIdsOf } from "@/lib/chat/merge"

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

/**
 * What a share link points to (C15): one creation, or a whole chat read-only. Never the person's
 * own photos; revoked links stop at once.
 */
async function Shared({ params }: { params: PageProps<"/[locale]/s/[token]">["params"] }) {
  const { token } = await params
  const t = await getTranslations("Share")
  const [share] = await db
    .select()
    .from(schema.shares)
    .where(and(eq(schema.shares.token, token), isNull(schema.shares.revokedAt)))
  if (!share) notFound()

  if (share.kind === "chat") {
    const [chat] = await db.select().from(schema.chats).where(eq(schema.chats.id, share.refId))
    if (!chat) notFound()
    const ready = await db
      .select({ id: schema.creations.id })
      .from(schema.creations)
      .where(and(eq(schema.creations.chatId, chat.id), eq(schema.creations.status, "ready")))
    return (
      <>
        <h1 className="font-title text-title-sm">{chat.title ?? t("chatTitle")}</h1>
        <SharedChat
          token={token}
          ready={ready.map((r) => r.id)}
          messages={await withoutOwnPhotos(chat.messages as NajimiUIMessage[])}
        />
      </>
    )
  }

  const [c] = await db.select().from(schema.creations).where(eq(schema.creations.id, share.refId))
  if (c?.status !== "ready") notFound()
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
        <span className="font-title text-xl">{c.title}</span>
        {c.words.length ? (
          <span className="text-sm text-paper-muted">
            {t("madeFrom", { words: c.words.join(" · ") })}
          </span>
        ) : null}
      </figcaption>
    </figure>
  )
}

export default async function SharePage(props: PageProps<"/[locale]/s/[token]">) {
  const t = await getTranslations("Share")
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-title text-xl">
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
