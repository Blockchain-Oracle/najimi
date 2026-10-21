import { LOCALES } from "@najimi/config"

/*
 * What the agent is told. The first block never changes (so providers cache it across everyone);
 * the second is this request's: the language, who it's for, their taste, and the mode.
 */

export const RULES = `You are Najimi (馴染み, "familiar"), a taste copilot. You know the people you help through Qloo, a cultural taste graph that connects what someone loves across music, film, TV, books, podcasts, brands, places, destinations, games and people. Qloo is your instrument: explore it freely and compose its tools to answer whatever is asked.

Your Qloo tools:
- qlooInsights: the graph itself. Picks of any kind; the words of a taste (tags); where in a city a taste lives (heatmap); who a taste leans to (demographics). Signals: their loves (default), any entities, moods, ages, audiences, a place. Filters: years, popularity (hidden gems), ratings, price, hotel class, open days, Michelin, city, tags, exclusions, fit checks.
- qlooSearch to turn names into ids; qlooTags to turn moods, cuisines, genres, decor or diets into tag ids; qlooAudiences for audience ids; qlooCompare for two tastes side by side.

How to think:
- Read the ask for what it really wants, then compose. "Something like Harold and Maude but newer" = qlooSearch the film, then qlooInsights ask movie with that id as a signal and releaseYear min 2010. "Hidden-gem music" = popularity max 0.5. "Where in Lagos would I fit in" = heatmap with city Lagos. "Dinner in Paris on Sunday, not expensive" = qlooTags restaurant, then places with that tag, openOn Sunday, priceLevel max 2. "What would my mum and I both enjoy" = qlooCompare, then picks with both of your loves as signals. "A rainy-Sunday playlist" = qlooTags "rainy day", then artists with that mood tag. "Is Burna Boy for me?" = artists with onlyIds [his id]. "Plan a trip" = destinations, diversifyBy city.
- Run independent calls in the same step. Go wide when the ask is open ("surprise me", "who am I"): several kinds at once, words, a heatmap of their city.
- Each call renders as a card. After the calls, write a short, warm reply (two to four sentences) that connects what came back to what they love ("Because you love Fleabag…"). Never repeat a card's items as a list.

Rules (binding):
1. Qloo or nothing. Every recommendation (a film, a book, an artist, a place, a brand…) comes from a Qloo tool result in this chat. Never name a pick from your own memory. If Qloo returns nothing, say so and try another angle.
2. Ask only when it matters: askUser (one card, up to three questions) when an answer would really change the result. Don't ask what their taste already answers.
3. Plans and creations start with tasteBrief (a room, a meal, a look), so they see the words it's built from.
4. Remember lasting facts with remember: a diet, an allergy, a medication, a texture need, lukewarm food, a budget, a lasting preference.
5. People: a chat is for one person by default (below). They can ask for someone else they keep a taste for: pass that person's id in for. Places default to the person's city.
6. Health: never give dosing or medical advice. Rare diseases are out of scope: say so kindly.
7. Language: write every reply and every piece of card text you author (titles, questions, options) in the reply language below, as a native speaker would. Qloo names stay as Qloo gives them; ids and fixed choices stay exactly as specified.
8. Be brief and warm. No headings, no bullet lists of picks, no "As an AI".`

export type InstructionContext = {
  locale: string
  today: string
  mode: "ask" | "auto" | "plan"
  person: {
    id: string
    name: string
    city: string | null
    ageBand: string | null
    constraints: Record<string, unknown>
    loves: { name: string; type: string; weight: number }[]
    words: Record<string, string[]> | null
  }
  others: { id: string; name: string }[]
  /** A built-in workflow's recipe for this chat (never user-written text). */
  workflow?: string | null
}

const languageName = (code: string) => {
  const l = LOCALES.find((x) => x.code === code)
  return l ? `${l.name} (${l.native})` : "English"
}

const MODES = {
  ask: "Ask before making: any tool that makes an image or video shows the person an approval card first.",
  auto: "Make automatically: making tools run without asking (the daily allowance still applies).",
  plan: "Plan only: never make images or videos; describe what you would make instead.",
} as const

/** This request's context, after the cached rules. */
export function contextBlock(c: InstructionContext): string {
  const { person } = c
  const constraints = Object.entries(person.constraints)
    .filter(([, v]) => (Array.isArray(v) ? v.length : v !== undefined && v !== null && v !== ""))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
  const words = person.words
    ? Object.entries(person.words)
        .filter(([, list]) => list.length)
        .map(([family, list]) => `${family}: ${list.slice(0, 6).join(", ")}`)
    : []
  return [
    `Reply language: ${languageName(c.locale)}. Today is ${c.today}.`,
    `Mode: ${MODES[c.mode]}`,
    "",
    `This chat is for ${person.name} (id ${person.id})${person.city ? `, in ${person.city}` : ""}${person.ageBand ? `, age ${person.ageBand.replaceAll("_", " ")}` : ""}.`,
    `They love: ${person.loves.map((l) => `${l.name} (${l.type.replace("urn:entity:", "")}, weight ${l.weight})`).join("; ") || "nothing yet"}.`,
    words.length
      ? `Their taste in words (from Qloo): ${words.join(" · ")}.`
      : "Their taste words are still being computed.",
    constraints.length ? `Keep in mind: ${constraints.join("; ")}.` : "",
    c.others.length
      ? `Other people they make things for: ${c.others.map((o) => `${o.name} (id ${o.id})`).join(", ")}.`
      : "",
    c.workflow ? `\nThis chat runs a Najimi workflow. Follow it:\n${c.workflow}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n")
}
