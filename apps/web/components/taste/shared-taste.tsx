import { TASTE_DOMAINS } from "@najimi/config"
import type { StoredPick, TasteWords } from "@najimi/db/schema"
import { getTranslations } from "next-intl/server"
import { PublicShareProvider } from "@/components/chat/public-share"
import { LovePill } from "@/components/loves/love-pill"
import { PickRail } from "@/components/picks/pick-rail"
import { TasteHero, WordPalette } from "@/components/taste/taste-hero"
import { TasteMap } from "@/components/taste/taste-map"

export type SharedTasteData = {
  token: string
  name: string
  identity: string
  look: string | null
  aura: { c1: string; c2: string; c3: string } | null
  loves: { qlooId: string; name: string; imageUrl: string | null; type: string }[]
  words: TasteWords | null
  picks: Record<string, StoredPick[]> | null
  bridges: { from: string; to: string; domain: string }[] | null
}

/**
 * A taste card someone shared (T19): their loves, the words Qloo found in them, what those connect,
 * and the picks. Read-only, and never the city, age or anything from About.
 */
export async function SharedTaste({ data }: { data: SharedTasteData }) {
  const t = await getTranslations("Taste")
  const td = await getTranslations("Domains")
  const labels = {
    aesthetic: t("words.aesthetic"),
    lifestyle: t("words.lifestyle"),
    style: t("words.style"),
    decor: t("words.decor"),
    ambience: t("words.ambience"),
    cuisine: t("words.cuisine"),
    dishes: t("words.dishes"),
  }
  return (
    <PublicShareProvider value={{ token: data.token, ready: [] }}>
      <div className="flex flex-col gap-8">
        <TasteHero
          person={{ name: data.name, isSelf: false, city: null }}
          look={data.look}
          aura={data.aura}
          words={data.words}
          loves={data.loves}
          live={false}
        />
        <section className="flex flex-col gap-6 rounded-card bg-card p-5 text-card-foreground shadow-paper">
          {data.words ? <WordPalette words={data.words} labels={labels} /> : null}
          <TasteMap
            person={{ name: data.name, look: data.look }}
            loves={data.loves}
            bridges={data.bridges ?? []}
            picks={data.picks ?? {}}
          />
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
              {t("loves")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {data.loves.map((l) => (
                <LovePill key={l.qlooId} name={l.name} image={l.imageUrl} type={l.type} />
              ))}
            </div>
          </div>
        </section>
        {TASTE_DOMAINS.filter(({ key }) => data.picks?.[key]?.length).map(({ key }) => (
          <PickRail
            key={key}
            title={td(key)}
            picks={data.picks?.[key]}
            loading={false}
            emptyText=""
          />
        ))}
      </div>
    </PublicShareProvider>
  )
}
