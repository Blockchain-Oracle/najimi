import "server-only"

export type Starter = { key: string; args?: Record<string, string> }

/**
 * The empty chat's first suggestions (a pure function, no model call), ranked by what this person
 * loves: a reader gets books first, a music lover a playlist, anyone with a city the places.
 */
export function startersFor(input: { loveTypes: string[]; city: string | null }): Starter[] {
  const has = (type: string) => input.loveTypes.includes(`urn:entity:${type}`)
  const out: Starter[] = [{ key: "whoAmI" }]
  if (input.city) out.push({ key: "fitIn", args: { city: input.city } })
  if (has("book")) out.push({ key: "nextRead" })
  if (has("artist")) out.push({ key: "playlist" })
  if (has("movie") || has("tv_show")) out.push({ key: "watch" })
  if (input.city) out.push({ key: "eat", args: { city: input.city } })
  out.push({ key: "hidden" }, { key: "trip" })
  return out.slice(0, 5)
}
