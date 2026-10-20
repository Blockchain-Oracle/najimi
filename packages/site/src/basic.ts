import type { BusinessProfile } from "./extract"
import type { SiteRead } from "./read"

/** schema.org types that mean a place people visit, a brand, or an artist. */
const PLACE =
  /Restaurant|BarOrPub|CafeOrCoffeeShop|Bakery|NightClub|MusicVenue|Museum|ArtGallery|Hotel|LodgingBusiness|Store|LocalBusiness|FoodEstablishment|TouristAttraction|EventVenue|Winery|Brewery/
const BRAND = /^(Organization|Corporation|Brand|OnlineStore|OnlineBusiness)$/
const ARTIST = /MusicGroup|Person|PerformingGroup/

/**
 * What the page code alone says (JSON-LD and metadata), with no model: used when Claude isn't
 * connected. Thin, but every field is something the site states.
 */
export function basicProfile(site: SiteRead): BusinessProfile {
  const types = site.jsonLd.types
  const kind = types.some((t) => PLACE.test(t))
    ? "place"
    : types.some((t) => ARTIST.test(t))
      ? "artist"
      : types.some((t) => BRAND.test(t))
        ? "brand"
        : "other"
  const facts: BusinessProfile["facts"] = []
  if (site.description)
    facts.push({ label: "In its own words", value: site.description, sourceUrl: site.url })
  if (site.jsonLd.cuisine.length)
    facts.push({ label: "Cuisine", value: site.jsonLd.cuisine.join(", "), sourceUrl: site.url })
  return {
    name: site.jsonLd.name ?? site.siteName ?? site.title ?? site.host,
    kind,
    category: types.find((t) => t !== "LocalBusiness" && t !== "Organization") ?? "",
    summary: site.description ?? "",
    language: site.language ?? "en",
    address: site.jsonLd.address ?? null,
    city: site.jsonLd.city ?? null,
    country: site.jsonLd.country ?? null,
    phone: site.jsonLd.phone ?? null,
    offerings: [],
    priceHint: null,
    competitorsMentioned: [],
    comparableNames: [],
    facts,
  }
}
