import { Orb } from "@najimi/ui/components/orb"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"
import { PersonView } from "@/components/people/person-view"
import { identityOf, selfOf } from "@/lib/people"
import { getSession } from "@/lib/session"
import { profileByUsername } from "@/lib/social"

type Props = PageProps<"/[locale]/u/[username]">

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `@${(await params).username}` }
}

async function Profile({ params }: Pick<Props, "params">) {
  const { username } = await params
  const session = await getSession()
  if (!session) redirect(`/start?next=${encodeURIComponent(`/u/${username}`)}`)
  const me = session.user.id
  const profile = await profileByUsername(decodeURIComponent(username), me)
  if (!profile) notFound()
  if (!profile.hidden && profile.isSelf) redirect(`/people/${profile.row.person.id}`)
  if (profile.hidden) {
    const t = await getTranslations("Social")
    return (
      <div className="mx-5 flex flex-col items-center gap-4 rounded-card bg-card px-6 py-12 text-center md:mx-0">
        <Orb size={88} colors={profile.row.person.aura ?? undefined} />
        <h1 className="font-title text-[2rem]">{profile.row.person.name}</h1>
        <p className="max-w-xs text-[15px] text-text-2">
          {t("hidden", { name: profile.row.person.name })}
        </p>
      </div>
    )
  }
  const viewer = await selfOf(me)
  const { row, loves, taste, saved, rel, counts } = profile
  return (
    <PersonView
      data={{
        person: {
          id: row.person.id,
          name: row.person.name,
          isSelf: true,
          city: row.person.city,
          look: row.person.look,
          aura: row.person.aura,
          username: row.username,
          bio: row.person.bio,
          visibility: row.person.visibility,
        },
        identity: identityOf(row.person.id, row.person.look),
        loves: loves.map((l) => ({
          id: l.id,
          qlooId: l.qlooId,
          type: l.type,
          name: l.name,
          imageUrl: l.imageUrl,
          weight: l.weight,
        })),
        taste: taste
          ? {
              words: taste.words,
              picks: taste.picks,
              bridges: taste.bridges,
              areas: taste.areas,
              runId: null,
              computedAt: taste.computedAt?.toISOString() ?? null,
            }
          : null,
        runStatus: null,
        saved: saved.map((s) => ({
          qlooId: s.qlooId,
          type: s.type,
          name: s.name,
          imageUrl: s.imageUrl,
        })),
      }}
      other={{
        userId: row.person.ownerId,
        username: row.username ?? username,
        relation: { following: rel.following, friends: rel.friends },
        followers: counts.followers,
        me: { name: viewer?.name ?? "", look: viewer?.look ?? null, aura: viewer?.aura ?? null },
      }}
    />
  )
}

/** Someone's profile, by their @username: their taste, how it meets yours, follow and message. */
export default function ProfilePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-5 h-96 animate-pulse rounded-card bg-card md:mx-0" />}>
      <Profile params={params} />
    </Suspense>
  )
}
