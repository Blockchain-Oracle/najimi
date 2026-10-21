/*
 * The built-in workflows (T15): recipes for bigger jobs over the same tools the chat always has.
 * Each is a few lines of instructions the agent follows when a chat runs it; names, descriptions
 * and the first message live in the app's message catalogs (one per language).
 */

export type BuiltInWorkflow = {
  slug: string
  category: "home" | "food" | "culture" | "style" | "film"
  needs: { photo?: boolean; person?: boolean }
  instructions: string
}

export const BUILT_IN_WORKFLOWS: BuiltInWorkflow[] = [
  {
    slug: "relight-my-room",
    category: "home",
    needs: { photo: true },
    instructions: `Relight my room (brief #1: lighting for mood, comfort and function).
1. If there's no room photo yet, ask for one and mention the sample rooms in the composer.
2. askUser once: what the room is for (several choices: reading, TV, dinner, working, relaxing, kids) and the mood they want most.
3. tasteBrief (focus home).
4. makeImage: restyle the photo, purpose relight, 1 variant, keeping the exact room; layered warm light from their words.
5. lightingPlan for that room and those uses.
6. qlooInsights ask brand, filter.tags ["urn:tag:wikipedia_category:lighting_brands"], take 8; then findProducts for 2–3 of those brands whose words fit their taste (category: the main fixture of the plan, e.g. "floor lamp").
7. qlooInsights ask artist with a mood tag that fits the room's evening (qlooTags first), take 6: the room's soundtrack.
8. Offer makeVideo of their favourite version (a slow push-in as the lamps warm up).`,
  },
  {
    slug: "make-it-mine",
    category: "style",
    needs: { photo: true },
    instructions: `Make it mine: restyle anything they photograph (a desk, a shelf, a cup, a plate, a corner, an outfit) in their taste.
1. If there's no photo yet, ask for one (or offer a sample room).
2. tasteBrief (focus home for spaces and objects, style for outfits).
3. makeImage restyle, 1 variant, keeping the real object or space; built from their aesthetic and decor words.
4. qlooInsights ask brand (take 8) for the look; findProducts for 2 brands that fit, category = the main object.
5. Offer a variation and a video.`,
  },
  {
    slug: "cook-for",
    category: "food",
    needs: { person: true },
    instructions: `Cook for… (brief #2: meals someone will love, safely).
1. Work for the chat's person (often someone the user cares for, like a parent). If their constraints are unknown, askUser once: diet, allergies, texture (IDDSI level), serve lukewarm, medications.
2. Save what you learn with remember.
3. If they take medication, medicationNotes first, and respect what the label says (e.g. vitamin K for warfarin, grapefruit for some statins).
4. tasteBrief (focus food). If their cuisine and dish words are thin, ask for restaurants they'd love near them (qlooInsights ask place, filter.tags ["urn:tag:genre:place:restaurant"]): each comes with what Qloo says it's known for; build on those cuisines and dishes.
5. recipe: from their cuisine and dish words, adapted to their texture level and temperature; then makeImage new, purpose dish, 1 variant.
6. Offer mealPlan for the week with a shopping list, and places near them with fitting dietary tags (qlooTags "vegetarian" etc., then qlooInsights ask place).`,
  },
  {
    slug: "next-read",
    category: "culture",
    needs: {},
    instructions: `Next read.
1. qlooInsights ask book (take 6), boosting the loves that are books when there are any.
2. For the top pick: makeImage new, purpose mood, 1 variant: the world of the book as a still (no text, no cover art).
3. qlooInsights ask artist with a mood tag that fits the book (qlooTags first): a reading playlist.
4. qlooInsights ask place, filter.tags cafe or bookstore near them: where to read it.`,
  },
  {
    slug: "dress-me",
    category: "style",
    needs: {},
    instructions: `Dress me.
1. tasteBrief (focus style).
2. If they shared a photo of an outfit or themselves, makeImage restyle keeping the person exactly (face, body, pose); otherwise makeImage new, purpose outfit: a flat lay of an outfit from their words.
3. qlooInsights ask brand (take 8); findProducts for 2–3 fashion brands that fit, category = the key piece.
4. A short playlist for getting ready (qlooInsights ask artist).`,
  },
  {
    slug: "my-taste-film",
    category: "film",
    needs: {},
    instructions: `My taste film: a short film of who they are.
1. qlooInsights ask tags (their words), and in the same step heatmap of their city if they have one.
2. makeImage new, purpose portrait, 1 variant: a cinematic scene made of their aesthetic, decor and ambience words (no faces of real people).
3. makeVideo from it: a slow camera move through the scene, with audio.
4. qlooInsights ask artist take 3: the soundtrack.`,
  },
  {
    slug: "night-in",
    category: "culture",
    needs: {},
    instructions: `Night in: a whole evening.
1. askUser once: who it's for (just me, a date, friends, family) and the mood.
2. In one step: qlooInsights ask movie (or tv_show), ask artist with a mood tag, and ask place filter.tags restaurant near them for takeaway.
3. recipe for something to cook from their cuisine words if they'd rather cook.
4. Offer makeImage new, purpose scene: the room set for the night.`,
  },
]

export const workflowBySlug = (slug: string) => BUILT_IN_WORKFLOWS.find((w) => w.slug === slug)
