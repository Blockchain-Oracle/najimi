import { db, schema } from "@najimi/db"
import { inArray } from "drizzle-orm"
import { Plus } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { LovesFan } from "@/components/taste/taste-card"
import { identityOf, peopleOf } from "@/lib/people"
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
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {people.map((p) => (
        <Link
          key={p.id}
          href={`/people/${p.id}`}
          className="overflow-hidden rounded-card bg-card text-card-foreground shadow-paper transition-transform hover:-translate-y-1"
        >
          <LovesFan identity={identityOf(p.id)} loves={loves.filter((l) => l.personId === p.id)} />
          <div className="flex items-baseline justify-between gap-2 p-4">
            <span className="font-title truncate text-xl">{p.name}</span>
            {p.isSelf ? (
              <span className="text-xs font-semibold text-paper-muted">{t("you")}</span>
            ) : null}
          </div>
        </Link>
      ))}
      <Link
        href="/people/new"
        className="grid min-h-56 place-items-center rounded-card border-2 border-dashed border-foreground/20 p-6 text-center transition-colors hover:border-lime hover:text-lime"
      >
        <span className="flex flex-col items-center gap-2 font-semibold">
          <Plus className="size-6" /> {t("someoneNew")}
        </span>
      </Link>
    </div>
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
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-card/10" />}>
        <PeopleList />
      </Suspense>
    </div>
  )
}
