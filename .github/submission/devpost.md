# Najimi · Find your people by what you love

![Najimi: find your people by what you love](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/banner.png)

**Try it:** [najimi.xyz](https://najimi.xyz) · **Code:** [GitHub](https://github.com/Blockchain-Oracle/najimi) · **Docs:** [docs.najimi.xyz](https://docs.najimi.xyz) · **Qloo integration:** [API map](https://docs.najimi.xyz/qloo)

## Inspiration

Most apps treat taste as a filter: pick a genre, get another list. But what we love also shapes where we go, who we click with, what we play together, and what a good night looks like. We wanted that connection to feel tangible. *Najimi* (馴染み) means someone familiar, someone who knows you well. Our question was: what would a social app feel like if it knew your taste that way?

Qloo made this possible. Its graph connects things across culture, so three different loves can become more than three separate recommendation lists. They can become one shared language for a feed, a map, a friendship, and an agent that helps you do something with them.

## What it does

**Start with three things you love.** Pick an artist, show, book, place, or brand and weight how much each counts. You can also bring in taste from Letterboxd, Goodreads, Last.fm, or names and handles from X and Instagram. Najimi builds a profile across music, films, TV, books, podcasts, brands, places, destinations, games, and people. Each pick shows *why* it appeared. Open one for its own detail view: watch a film trailer and find where to stream it; play an artist's songs and see upcoming concerts; open a book's reading and review links; or get directions, hours, and a ride to a place. The view also shows the Qloo connection behind the pick.

That taste becomes a whole app:

- **Feed:** a full-screen mix of songs, trailers, podcasts, books, and places. Play a preview or trailer, love or skip a pick, or tune the mix. A “Why this?” chip connects the card to one of your loves and its Qloo call.
- **People and circles:** find people with overlapping taste, compare with a friend, make a circle, and ask Najimi in the group chat. The agent can suggest something for everyone and show each person's fit.
- **Games:** play *Guess my wavelength*, *How well do you know me*, *Taste twins*, or *Blind Taste*. Qloo scores the hidden answer; daily circle drops, challenge links, and a leaderboard give friends a reason to return.
- **Earth:** see where your taste concentrates in a city. Open a square for its local scene: artists, places, brands, and words. Switch between your taste and a circle's, or use the taste twin radar.
- **Graph:** pull a love's weight, expand a node into other categories, overlay a friend's taste, and revisit how yours changed.
- **Plans:** ask for a night out or a trip. Najimi uses Qloo to choose areas and stops, shows how each stop fits the people involved, builds a route, adds nearby shows, and gives you a shareable plan and calendar link.
- **Your feeds:** examine X, Instagram, TikTok, or YouTube one platform at a time. Bring in what you already follow, score a screenshot of your feed against your taste, see accounts and topics to try, and connect X or Instagram for a scheduled “Do it for me” follow flow.
- **Business mode:** give Najimi a place you run. It reads the site, identifies the business or comparable places in Qloo, and builds a shareable plan around who its people are, what else they love, where they cluster, the street's scene, and ideas to try.
- **Passport and Wrapped:** see the loves, nights, trips, and games that marked your year, then make story slides from them.

Najimi works on desktop and mobile. A guest can start without an account, then keep their taste if they sign in later.

## Inside the working app

The captures below come from a guest walkthrough made for this submission. Its profile and business are illustrative test data.

**One profile, many paths.** Three weighted loves produced a cross-category taste, a neighborhood, and an explorable graph.

![Wide desktop taste profile showing three loves, 60 picks, Victoria Island, and the graph](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/01-profile-top.jpg)

**A pick is a place to go deeper.** The film sheet plays a trailer and shows watch links; the artist sheet previews songs and shows a concert; the place sheet offers directions, hours, rides, and its Qloo contribution.

![Beautiful Boy film sheet with trailer and where-to-watch options](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/02-film-trailer.jpg)

![Jorja Smith artist sheet with song previews and a concert](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/03-artist-songs-tour.jpg)

![NOK by Alara place sheet with directions, hours, and taste contribution](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/04-place-nok.jpg)

**The reason stays visible.** “Why this?” reveals how the three loves contributed to a feed pick and exposes the Qloo `/v2/insights` request behind it.

![Qloo explanation for a feed pick, including weighted contributions and the API call](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/08-qloo-explanation.jpg)

**Taste leaves the screen.** Earth opens Victoria Island's artists, places, and local signals; the agent turns that area into a routed night with stops and calendar links.

![Victoria Island scene with Qloo-linked artists and places](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/13-earth-victoria-island.jpg)

![A mapped night around Victoria Island with three stops and travel options](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/20-plan-route.jpg)

**It travels with you.** The same guest profile, film trailer, playable feed, Earth scene, Blind Taste round, and Instagram discovery view work on a phone.

![Mobile profile with three loves and a local neighborhood](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/01-profile.jpg)

![Mobile film detail showing the Beautiful Boy trailer and where-to-watch options](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/03-film-trailer.jpg)

![Mobile feed with a playable music pick and its taste explanation](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/06-feed.jpg)

![Mobile Victoria Island scene with local artists and places](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/08-earth-scene.jpg)

![Mobile Blind Taste round](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/05-blind-taste.jpg)

![Mobile Instagram discovery; the account is not connected](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/09-instagram.jpg)

## The agent, and why Qloo matters

Najimi is in your own chat and in every circle. It can see the screen you opened it from, use your taste and the group's tastes, then compose tools for the request. Ask for hidden-gem films from the 1970s, a place for everyone tonight, a route through a city, or a business idea for your street. It can search Qloo, look up tags and audiences, request insights with filters, compare tastes, and score specific candidates. It turns those results into group fit cards, games, plans, and business plans. Steps appear in chat as they run. Actions in your name, such as a call or post, require approval.

The core taste reveal sends **weighted entity signals** to Qloo's /v2/insights across ten domains with explainability enabled. Qloo's tag insights become the words of your taste; its heatmaps become Earth and trip areas; location signals describe a square's scene; entity filters score game answers and each person's fit; and /v2/analysis/compare supports person-to-person and business-to-street comparisons. The agent can also use /search, /entities, /v2/tags, and /v2/audiences. A Qloo chip exposes the request behind a pick or chat card. [The docs map every call to its screen](https://docs.najimi.xyz/qloo).

In a live guest walkthrough, three weighted loves—Burna Boy, *Insecure*, and *Americanah*—produced a profile spanning Jorja Smith, books, places in Lagos, destinations, and more. Earth then opened Victoria Island's scene with local artists, venues, brands, and tags. Those relationships are the product's raw material; the agent does not invent the cultural fit.

## How we built it

Najimi is a Next.js 16 app in a pnpm monorepo, with Postgres, Drizzle, a pg-boss worker, and server-sent live events. The worker handles Qloo taste refreshes, agent turns, plans, scheduled tasks, and follow-ups. Qloo requests pass through one typed client with a concurrency limit, retries, a body-aware cache, and a per-call log. The interface uses React, Tailwind CSS, MapLibre, and a globe and graph for geographic and relational views. The AI agent uses the Vercel AI SDK and OpenAI. Supporting integrations include Apple previews and TMDB trailers in the feed, Mapbox routes and Ticketmaster shows in plans, and optional Nuitee, ElevenLabs/Twilio, X, and Instagram connections for actions. [The architecture is documented here](https://docs.najimi.xyz/architecture).

## Challenges and what we learned

- **One taste across many surfaces.** Feed cards, map squares, game answers, group fits, and plans cannot each invent a separate notion of “you.” We built them around weighted loves and Qloo responses so a change in taste can flow through the app.
- **Making recommendations inspectable.** Affinity alone is hard to trust. We carry Qloo's explainability into “because” chips and expose the underlying request on the profile and agent cards.
- **Keeping a social agent live.** A circle's agent turn can outlast one person's tab. Rooms persist messages, queue one turn at a time, and stream progress back to members through the live event pipe.
- **Joining cultural data to the real world.** A map needs named areas and scenes; a plan needs routes, times, group fit, and events. Qloo grounds the choices, while the supporting services make them usable.

We learned that Qloo is strongest here as a shared model of taste across actions, not as a single recommendation endpoint. The same signal can explain a song, reveal a neighborhood, settle a game, and help a group choose where to go.

## What we're proud of

The first version is a usable guest journey: choose three loves, see a taste across categories with reasons, play the feed, explore it on Earth, meet people, and ask an agent that uses the same taste. The public repository includes the source, assets, run instructions, and MIT license. The live app and docs are hosted externally.

## What's next

This is version one. Next we want to make the group experience richer, improve the clarity of connected social-account controls, and keep testing the real-world booking and follow-up flows. We also want to measure whether Qloo-grounded choices beat a generic assistant in real sessions, instead of assuming they do.

## Try it yourself

1. Open [najimi.xyz](https://najimi.xyz) on desktop or phone and tap **Start — it's free**. A guest can begin without an account.
2. Pick three different loves and adjust their weights. Open a “Why this?” chip on a pick to see the Qloo connection.
3. Try the feed, an entity's deeper view, Earth, People, and the taste graph. Play a game. Ask Najimi for a night out that fits your taste.

Explore the [public code](https://github.com/Blockchain-Oracle/najimi), [product guide](https://docs.najimi.xyz/guide), and [Qloo call map](https://docs.najimi.xyz/qloo).
