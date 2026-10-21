import { cached } from "./cache"

/** Words that make a label sentence about food or drink (what "Cook for…" needs). */
const FOOD =
  /\b(grapefruit|vitamin k|leafy|green vegetables|alcohol|food|meal|diet|dairy|milk|calcium|caffeine|juice|cranberr|salt|potassium|tyramine|cheese|fasting|empty stomach|with food)\b/i

export type LabelNote = {
  medication: string
  found: boolean
  brand: string | null
  excerpts: { section: string; text: string }[]
  setId: string | null
  effective: string | null
  url: string | null
}

const SECTIONS = [
  "drug_interactions",
  "information_for_patients",
  "warnings_and_cautions",
  "warnings",
  "dosage_and_administration",
] as const

/** Sentences from the FDA label about food and drink, cited (openFDA drug labels; cached 30 days). */
export async function labelNotes(generic: string): Promise<LabelNote> {
  const name = generic
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
  return cached("fda", name, 30, async () => {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22${encodeURIComponent(name)}%22&limit=1`
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
    const body = response?.ok
      ? ((await response.json()) as { results?: Record<string, unknown>[] })
      : null
    const label = body?.results?.[0]
    if (!label)
      return {
        medication: generic,
        found: false,
        brand: null,
        excerpts: [],
        setId: null,
        effective: null,
        url: null,
      }
    const excerpts: LabelNote["excerpts"] = []
    for (const section of SECTIONS) {
      const text = (label[section] as string[] | undefined)?.join(" ") ?? ""
      for (const sentence of text.split(/(?<=[.;])\s+/)) {
        if (FOOD.test(sentence) && sentence.length < 600 && excerpts.length < 6)
          excerpts.push({ section: section.replaceAll("_", " "), text: sentence.trim() })
      }
    }
    const openfda = (label.openfda ?? {}) as { brand_name?: string[] }
    const setId = (label.set_id as string | undefined) ?? null
    return {
      medication: generic,
      found: true,
      brand: openfda.brand_name?.[0] ?? null,
      excerpts,
      setId,
      effective: (label.effective_time as string | undefined) ?? null,
      url: setId ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${setId}` : null,
    }
  })
}
