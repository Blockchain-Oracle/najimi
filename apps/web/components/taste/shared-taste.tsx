import { TASTE_DOMAINS } from "@najimi/config"
import type { StoredPick, TasteWords } from "@najimi/db/schema"
import { getTranslations } from "next-intl/server"
import { PublicShareProvider } from "@/components/chat/public-share"
import { LovePill } from "@/components/loves/love-pill"
import { PickRail } from "@/components/picks/pick-rail"
import { LovesFan, TasteWordsView } from "@/components/taste/taste-card"

export type SharedTasteData = {
  token: string
  name: string
  identity: string
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
      <div className="flex flex-col gap-10">
        <section className="overflow-hidden rounded-card bg-card text-card-foreground shadow-paper">
          <LovesFan identity={data.identity} loves={data.loves} />
          <div className="flex flex-col gap-5 p-5">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                {t("theirs", { name: data.name })}
              </p>
              <h1 className="font-title text-title-sm">{data.name}</h1>
            </div>
            {data.words ? <TasteWordsView words={data.words} labels={labels} /> : null}
            {data.bridges?.length ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-paper-muted uppercase">
                  {t("bridges")}
                </p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {data.bridges.slice(0, 4).map((b) => (
                    <li key={`${b.domain}-${b.to}`}>
                      <span className="text-paper-muted">{td(b.domain as "artist")}: </span>
                      {t("bridged", { from: b.from, to: b.to })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
