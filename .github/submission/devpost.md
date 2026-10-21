# Najimi · 馴染み: the taste copilot

**Tagline:** Tell it three things you love. It reads your taste through Qloo, then makes things for your real life that fit you.

**Try it:** https://najimi.84.46.247.92.sslip.io (no account; works on a phone)
**Docs:** https://najimi-docs.84.46.247.92.sslip.io · **How it uses Qloo:** https://najimi-docs.84.46.247.92.sslip.io/qloo
**Code:** the repository linked on this page (MIT)

## Inspiration

Recommendations stop at a list. A list of "lamps you might like" doesn't relight your room, and "restaurants for you" doesn't cook dinner for a parent on warfarin who needs soft food served lukewarm. Chat assistants can make things, but they don't know your taste: ask them to restyle two different people's rooms and you get the same beige room twice.

We wanted an agent that knows what you love the way a close friend does (*najimi*, 馴染み, means "familiar") and uses that to make real things: for you, and for the people you look after.

## What it does

1. **Your taste, live.** You give Najimi three things you love (a book, an artist, a show) and how much each counts. Qloo turns them into the words your taste is made of (Look: Minimalist, Clean Lines; Rooms: Homey, Speakeasy; Food: Caribbean, Comfort Food) and picks across ten domains, each with a **because** chip naming the love that led to it.
2. **A chat that makes things.** Ask anything, for yourself or for anyone in **People**. Najimi restyles *your own* photo in your taste (keeping every wall and chair), writes lighting plans an electrician can install (layers, kelvin, lumens, placement), finds real products from brands Qloo matches to you (read from each brand's own site, with prices), cooks recipes at the right IDDSI texture and serving temperature, checks the FDA label of someone's medication first, and builds playlists, reading lists and nights in.
3. **Workflows.** Seven ready-made recipes (Relight my room, Make it mine, Cook for…, Next read, Dress me, My taste film, Night in). Any chat that went well can be saved as your own workflow: Najimi drafts the steps in your language and you edit them. Every workflow has a link that takes a newcomer through the taste sign-up and straight into the run.
4. **Proof, everywhere.** Every Qloo card has a chip that opens the exact request. Every taste page lists the calls behind it. **Compare without taste** answers the same ask with no Qloo, side by side.
5. **Sharing that respects people.** Share a creation, a whole chat or a taste card; links unfurl with a picture. Your own photos, city and health details are never shared. Stop any link at once from Settings, or delete everything you have.
6. **Twelve languages**, Arabic right to left, with the agent replying in yours. Voice dictation on the phone.

## How the agent uses Qloo

Qloo is the agent's instrument, not a single button. The model gets Qloo's surface as tools and composes them per ask:

- `qlooSearch` (`/search`) turns names into ids; `qlooTags` (`/v2/tags`) finds moods, cuisines, decor and place kinds by meaning.
- `qlooInsights` (`/v2/insights`) with the person's loves as **weighted** signals (`{ id, weight }`) and every documented filter: "70s films" → `releaseYear`; "hidden gems" → `popularity ≤ 0.3`; "where would I hang out in Paris" → a **heatmap** with named areas; "dinner for Mum" → `age 55_and_older` plus her city; "is this a fit for me?" → `onlyIds` for a score; the **demographic** lean of a taste.
- `qlooCompare` (`/v2/analysis/compare`) for two tastes, and `qlooAudiences` (`/v2/audiences`) to lean a taste by life stage or hobbies.
- Qloo's **explainability** becomes the "because" chip and the "what your taste connects" line ("Insecure led to Jorja Smith").

Then the taste becomes material: a `tasteBrief` picks the words that matter for the job (home, food, style), and those words drive the restyle prompt, the lighting mood, the recipe's cuisine and the brands searched for products. A typical **Relight my room** run: ask what the room is for → taste brief → two restyles of the real photo → lighting plan → Qloo lighting brands → real lamps → a soundtrack from a Qloo mood tag.

## How we built it

- **Next.js 16** (App Router, partial prerendering) and **AI SDK 7**: one chat route streams tool cards, saves after every step, and keeps running if the page closes. Approvals for anything that costs are signed so they can't be forged.
- A **pg-boss** worker on **Postgres 17** runs the taste reveal, image and video jobs, chat titles and a nightly guest sweep; live progress travels through Postgres `LISTEN/NOTIFY` to pages as server-sent events.
- A Qloo client with stable-key caching, in-flight de-duplication and a per-call log (the source of every "Qloo" chip).
- OpenAI for the agent and images, fal for video (built, waiting on a key), ElevenLabs for voice, openFDA for labels, Resend for sign-in codes; media in **RustFS** (S3) behind signed links.
- next-intl with twelve catalogs filled by a translation script that only accepts answers keeping each message's ICU structure.
- Everything runs as containers on **Coolify**.

## Challenges

- **Making the agent use Qloo fully.** Our first version wrapped Qloo in a narrow `recommend(domain, city)` tool and every answer looked the same. Rebuilding the tools to mirror Qloo's real surface, with worked examples, is what made the answers specific.
- **Restyling without losing the room.** Edits had to keep the exact layout and furniture while changing light and mood; the prompts are built from the person's decor and ambience words, not generic styles.
- **Real products, not category pages.** Brand sites mix listings and products; we only accept pages with structured product data and a price.
- **Privacy in sharing.** A shared chat could carry the owner's photo in its data even when the page hid it, so photos are removed on the server before a shared page is built.

## Accomplishments

- A new person's taste appears in about four seconds, across all ten domains, explained.
- Every answer is checkable: the request behind each card, and the same ask without Qloo beside it.
- Care use cases done properly: texture levels, lukewarm serving and medication interactions for someone you cook for.
- A product a stranger can use on a phone in three minutes, in twelve languages.

## What we learned

Taste data is most useful as **vocabulary**. A list of picks is a dead end; the words those picks share (warm, speakeasy, clean lines) can drive images, lighting, food and shopping. And an agent is only as good as the surface it can reach: give it the whole API and examples of composing it, not a convenience wrapper.

## What's next

- Turn video on (the pipeline is built) for short films of a restyled room or a taste.
- Couples and households: one plan that fits two tastes, using `qlooCompare`.
- Shopping lists and store availability near you for the products and recipes it suggests.
- Native share sheets and saved rooms you can come back to.

## Built with

Qloo API · Next.js · React · AI SDK · OpenAI · fal · ElevenLabs · openFDA · Postgres · Drizzle · pg-boss · RustFS · Better Auth · next-intl · Tailwind CSS · Fumadocs · Coolify

## Testing instructions for judges

1. Open https://najimi.84.46.247.92.sslip.io on a phone and tap **Start — it's free**. No account is needed.
2. Add three things you love, set how much each counts, and watch your taste arrive.
3. Open **Workflows → Relight my room**, pick a sample room, answer the two questions, and approve the images.
4. Under the last answer, try **Compare without taste**, then **Share**.

The app is free and open to judges through the judging period. Images and videos have a daily allowance per person, shown in Settings.
