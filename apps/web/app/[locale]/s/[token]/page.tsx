import { db, schema } from "@najimi/db"
import { and, eq, isNull } from "drizzle-orm"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

/** The thing a share link points to: the creation only, never the person's own photo. */
async function Shared({ params }: { params: PageProps<"/[locale]/s/[token]">["params"] }) {
  const { token } = await params
  const t = await getTranslations("Share")
  const [share] = await db
    .select()
    .from(schema.shares)
    .where(and(eq(schema.shares.token, token), isNull(schema.shares.revokedAt)))
  if (share?.kind !== "creation") notFound()
  const [c] = await db.select().from(schema.creations).where(eq(schema.creations.id, share.refId))
  if (c?.status !== "ready") notFound()
  const src = (id: string, v: string) =>
    `/api/media/creation/${id}?v=${v}&share=${encodeURIComponent(token)}`
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
      <p className="text-text-2">{t("pitch")}</p>
    </main>
  )
}

export default function SharePage(props: PageProps<"/[locale]/s/[token]">) {
  return (
    <Suspense fallback={null}>
      <Shared params={props.params} />
    </Suspense>
  )
}
