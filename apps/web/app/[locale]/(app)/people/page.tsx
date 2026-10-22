import { db, schema } from "@najimi/db"
import { inArray } from "drizzle-orm"
import { ChevronRight, Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { Face } from "@/components/taste/face"
import { peopleOf } from "@/lib/people"
import { getSession } from "@/lib/session"

async function PeopleList() {
  const t = await getTranslations("People")
  const session = await getSession()
  if (!session) redirect("/start")
  const people = await peopleOf(session.user.id)
  if (!people.some((p) => p.isSelf)) redirect("/start")
  const loves = people.length
    ? await db
        .select()
        .from(schema.loves)
        .where(
          inArray(
            schema.loves.personId,
            people.map((p) => p.id),
          ),
        )
    : []
  // One row per person on a panel: their face, their name, and the loves their taste is made of.
  return (
    <ul className="overflow-hidden rounded-card bg-card shadow-paper">
      {people.map((p) => {
        const theirs = loves.filter((l) => l.personId === p.id).slice(0, 3)
        return (
          <li key={p.id} className="border-b border-border">
            <Link
              href={`/people/${p.id}`}
              className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/4"
            >
              <Face look={p.look} name={p.name} size="md" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-heading text-[15px]">{p.name}</span>
                  {p.isSelf ? <span className="text-xs text-text-3">{t("you")}</span> : null}
                </span>
                <span className="text-[13px] text-text-3 group-hover:text-text-2">
                  {t("openTaste")}
                </span>
              </span>
              <span className="flex -space-x-2" aria-hidden>
                {theirs.map((l) => (
                  <span
                    key={l.id}
                    className="size-8 overflow-hidden rounded-[5px] bg-raised ring-2 ring-card"
                  >
                    {l.imageUrl ? (
                      // biome-ignore lint/performance/noImgElement: Qloo artwork from its own CDN
                      <img src={l.imageUrl} alt="" className="size-full object-cover" />
                    ) : null}
                  </span>
                ))}
              </span>
              <ChevronRight className="size-4 shrink-0 text-text-4 rtl:rotate-180" />
            </Link>
          </li>
        )
      })}
      <li>
        <Link
          href="/people/new"
          className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/4"
        >
          <span className="grid size-12 place-items-center rounded-full bg-raised shadow-sticker">
            <Plus className="size-5 text-text-2" strokeWidth={1.5} />
          </span>
          <span className="font-heading text-[15px]">{t("someoneNew")}</span>
        </Link>
      </li>
    </ul>
  )
}

export default async function PeoplePage() {
  const t = await getTranslations("People")
  return (
    <div className="flex flex-col gap-6 px-5 pb-16 md:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="font-title text-title-sm">{t("title")}</h1>
        <p className="text-text-2">{t("hint")}</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-card" />}>
        <PeopleList />
      </Suspense>
    </div>
  )
}
