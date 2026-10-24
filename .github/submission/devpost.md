# Najimi · Make more of what you love

![Najimi: Make more of what you love. Your taste, made social, with an agent that plans for everyone.](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/banner.png)

**Your taste, made social, with an agent that plans for everyone.** Through Qloo, what you love becomes a feed, friends, games and a map, and an agent in every chat plans nights and trips for everyone's taste. Open any pick to see *why* it fits.

**Try it:** [najimi.xyz](https://najimi.xyz) · **Code:** [GitHub](https://github.com/Blockchain-Oracle/najimi) · **Docs:** [docs.najimi.xyz](https://docs.najimi.xyz) · **Qloo integration:** [API map](https://docs.najimi.xyz/docs/qloo)

## Inspiration

Friends plan in their group chat: where to eat on Friday, what to watch on Sunday. Each person knows what they like. Nobody knows what everyone likes. So it usually goes like this:

1. Someone asks "where should we go tonight?"
2. The replies: "idk", "anywhere", "you pick".
3. The loudest person, or whoever's feed showed them something last, names a place.
4. The rest go along, or the chat goes quiet.
5. Someone still has to look it up, call and book. Often nobody does.

The night fits one person's taste, or it never happens.

The apps that know your taste each know one slice of one person: your music app knows your music, your streaming app your films. Spotify's Blend mixes up to ten friends' music into one playlist, but stops at music. A group-chat poll counts votes, but someone has to come up with the options. ChatGPT can join a group chat now, but it leaves everyone's memory out, so it knows only what's typed there. The group still guesses, and one person still does the booking.

So we built Najimi. It reads each friend's taste from the things they love, through Qloo, and puts an agent in the group chat that knows all of them. One line, "@najimi find us a spot tonight", and it scores every place for each person, shows whose taste it fits and why, routes the night and, with a yes, phones the venue and books it. Nobody has to be the organiser; the group just says yes. *Najimi* (馴染み) means someone you know well.

## What it does

Start with three things you love, or bring a Letterboxd, Goodreads or Last.fm name. Najimi builds a taste profile across music, films, TV, books, podcasts, brands, places, destinations, games and people. That taste drives a playable feed, an explorable graph and globe, people and circles, social games, and plans you can actually use. Open any pick for its own sheet: a film's trailer and where to stream it, an artist's songs and next concerts, a book's reading links, or a place's directions, hours and a ride. A *Why this?* chip shows the Qloo relationship behind the pick.

The agent lives in your own chat and in every circle. **Say `@najimi` in a group chat:** it blends everyone's loves into one Qloo signal, scores every candidate against each person's own taste, and answers with a card the whole room sees live, each pick with its *because*.

In the *Friday crew* circle, Juno wrote "@najimi find us a spot tonight". Najimi asked Qloo for places in Lagos for both members' tastes, then scored the same five places once per member:

- Afrinolly Creative Hub (Oregun): Juno 75%, Kemi 75%
- Rele Gallery: Juno 74%, Kemi 76%
- **NOK by Alara (Victoria Island): Juno 74%, Kemi 74%**
- Crescendo Lounge And Bar: Juno 74%, Kemi 73%
- Ikoyi Club Suya (Ikoyi): Juno 74%, Kemi 73%

It picked NOK by Alara, "an equally strong match for Juno and Kemi at 74% each, so neither person's taste takes a back seat." Asked for a night out, it routes three Qloo places in order (on najimi.xyz: THE HOUSE Lagos at 20:00, NOK by Alara at 21:30, Lagos Jet Ski Riders at 23:30, 71 minutes and 6 km), with an Uber per leg, calendar links and *Ask Najimi to book*, a phone call that waits for a yes. The next morning it asks how the night went.

![In the Friday crew circle, one ask returns five Lagos places, each scored for Juno and for Kemi](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/captures/group-fit.jpg)

![Najimi's night plan card: three stops in order, each with its time and because](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/fullwide/19-agent-night-plan.jpg)

That taste keeps working across the app:

- **Feed:** a full-screen mix of songs, trailers, podcasts, books, and places. Play a preview or trailer, love or skip a pick, or tune the mix. A “Why this?” chip connects the card to one of your loves and its Qloo call.
- **People and circles:** find people with overlapping taste, compare with a friend, make a circle, and ask Najimi in the group chat. The agent can suggest something for everyone and show each person's fit.
- **Stories:** share a photo, video, song, pick, or plan for a day; friends can reply in your DMs.
- **Games:** play *Guess my wavelength*, *How well do you know me*, *Taste twins*, or *Blind Taste*. Qloo scores the hidden answer; daily circle drops, challenge links, and a leaderboard give friends a reason to return.
- **Earth:** see where your taste concentrates in a city. Open a square for its local scene: artists, places, brands, and words. Switch between your taste and a circle's, or use the taste twin radar.
- **Graph:** pull a love's weight, expand a node into other categories, overlay a friend's taste, and revisit how yours changed.
- **Plans:** ask for a night out or a trip. Najimi uses Qloo to choose areas and stops, shows how each stop fits the people involved, builds a route, adds nearby shows, and gives you a shareable plan and calendar link.
- **Booking by phone:** with your yes, Najimi phones the venue, says it's an AI, and asks for the table. Within a minute the chat shows the outcome (booked, a time they offered, busy, no answer) with the call's recording; you get it by email too, a reminder the day before, and one tap into Google Calendar.
- **Calls:** call your circle or a friend in the app, bring Najimi in, and it answers out loud when you say its name, puts its cards in the chat, and leaves a summary. You can also add Najimi to a phone call you're already on.
- **Your feeds (coming soon):** connecting X, Instagram, TikTok and YouTube so what you follow and like becomes taste, with agents that follow and like for you. It's built, and switched off on najimi.xyz until connecting is one tap; it's our next milestone.
- **Business mode:** give Najimi a place you run. It reads the site, identifies the business or comparable places in Qloo, and builds a shareable plan: who its people are in one card, then three moves for the week, each with one next step (post it, invite the partner, plan it, play the set).
- **Passport and Wrapped:** see the loves, nights, trips, and games that marked your year, then make story slides from them.

Najimi works on desktop and mobile, in twelve languages, and writes to you in its own look (a welcome, a Sunday "week in taste", booking news), each email with one-click unsubscribe. A guest can start without an account, then keep their taste if they sign in later.

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

**It travels with you.** The same guest profile, film trailer, playable feed, Earth scene and Blind Taste round work on a phone.

![Mobile profile with three loves and a local neighborhood](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/01-profile.jpg)

![Mobile film detail showing the Beautiful Boy trailer and where-to-watch options](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/03-film-trailer.jpg)

![Mobile feed with a playable music pick and its taste explanation](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/06-feed.jpg)

![Mobile Victoria Island scene with local artists and places](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/08-earth-scene.jpg)

![Mobile Blind Taste round](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/submission/mobile/05-blind-taste.jpg)

## The agent, and why Qloo matters

Najimi is in your own chat and in every circle. It can see the screen you opened it from, use your taste and the group's tastes, then compose tools for the request. Ask for hidden-gem films from the 1970s, a place for everyone tonight, a route through a city, or a business idea for your street. It can search Qloo, look up tags and audiences, request insights with filters, compare tastes, and score specific candidates. It turns those results into group fit cards, games, plans, and business plans. Steps appear in chat as they run. Actions in your name, such as a call or post, require approval.

The core taste reveal sends **weighted entity signals** to Qloo's /v2/insights across ten domains with explainability enabled. Qloo's tag insights become the words of your taste; its heatmaps become Earth and trip areas; location signals describe a square's scene; entity filters score game answers and each person's fit; and /v2/analysis/compare supports person-to-person and business-to-street comparisons. The agent can also use /search, /entities, /v2/tags, and /v2/audiences. A Qloo chip exposes the request behind a pick or chat card. [The docs map every call to its screen](https://docs.najimi.xyz/docs/qloo).

In a live guest walkthrough, three weighted loves—Burna Boy, *Insecure*, and *Americanah*—produced a profile spanning Jorja Smith, books, places in Lagos, destinations, and more. Earth then opened Victoria Island's scene with local artists, venues, brands, and tags. Those relationships are the product's raw material; the agent does not invent the cultural fit.

## How it works

Every chat is a room. A message is saved and announced on the room's live topic; if it calls Najimi, a worker runs one turn for that room, with Qloo as its instrument, and streams each step to everyone in it.

![The system: phones talk to the web app; Postgres carries rooms, tastes, plans and the Qloo call log; the worker runs Najimi's turns against Qloo, the model and outside services](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/system-light.png)

![A group turn: Juno asks, the web app queues one turn for the room, Najimi asks Qloo for places for both tastes, scores them per person, and streams the card to Juno and Kemi](https://raw.githubusercontent.com/Blockchain-Oracle/najimi/main/.github/assets/group-turn-light.png)

## How Najimi meets the brief

*Agents, but with taste*: Najimi is an application built with an agent framework (the AI SDK's tool loop), with Qloo's API as its instrument, and its first rule is *Qloo or nothing*: every recommendation comes from a Qloo result in that chat.

- **Technological Implementation:** rooms on Postgres, one agent turn per room in a pg-boss worker, every step streamed to every member over server-sent events; a cached, rate-limited, logged Qloo client; actions in someone's name approved only by the person who asked.
- **Design:** one coherent app across the feed, people, games, the map and the agent, where a single sheet opens any thing the same way everywhere and cards play and route in place.
- **Potential Impact:** the group chat is where friends already decide; Najimi answers there, for everyone at once, routes the night and asks before it books. The same taste runs the feed, games, map and a business owner's weekly moves.
- **Quality of the Idea:** Qloo scores each pick for each person, so the room sees whose taste it fits and why, instead of one person's feed or a model's guess.

## How we built it

Najimi is a Next.js 16 app in a pnpm monorepo, with Postgres, Drizzle, a pg-boss worker, and server-sent live events. The worker handles Qloo taste refreshes, agent turns, plans, scheduled tasks, and follow-ups. Qloo requests pass through one typed client with a concurrency limit, retries, a body-aware cache, and a per-call log. The interface uses React, Tailwind CSS, MapLibre, and a globe and graph for geographic and relational views. The AI agent uses the Vercel AI SDK and OpenAI. Supporting integrations include Apple previews and TMDB trailers in the feed, Mapbox routes and Ticketmaster shows in plans, ElevenLabs and Twilio for phone calls, LiveKit for calls in the app, Resend for email, and Nuitee for hotels. [The architecture is documented here](https://docs.najimi.xyz/docs/build).

## Challenges and what we learned

- **One taste across many surfaces.** Feed cards, map squares, game answers, group fits, and plans cannot each invent a separate notion of “you.” We built them around weighted loves and Qloo responses so a change in taste can flow through the app.
- **Making recommendations inspectable.** Affinity alone is hard to trust. We carry Qloo's explainability into “because” chips and expose the underlying request on the profile and agent cards.
- **Keeping a social agent live.** A circle's agent turn can outlast one person's tab. Rooms persist messages, queue one turn at a time, and stream progress back to members through the live event pipe.
- **Joining cultural data to the real world.** A map needs named areas and scenes; a plan needs routes, times, group fit, and events. Qloo grounds the choices, while the supporting services make them usable.

We learned that Qloo is strongest here as a shared model of taste across actions, not as a single recommendation endpoint. The same signal can explain a song, reveal a neighborhood, settle a game, and help a group choose where to go.

## What we're proud of

The group card makes the cultural reasoning visible to everyone at once: one request, five real Qloo places, and a separate fit for Juno and Kemi on each. It carries forward into a routed night instead of ending as a list of recommendations. The same Qloo-backed taste also powers a guest journey across picks, playable media, people, games, Earth, and the feed. The public repository includes the source, assets, run instructions, and MIT license; the app and docs are live.

## Honest limits

The people in the captures are test members; we have not tested Najimi with outside users yet. On najimi.xyz Najimi has phoned a venue and booked a table in a live call (23 October); hotel booking is not switched on there yet. These are the real-world flows we will test next.

## What's next

Najimi goes wherever people already plan together: into Google Meet and Zoom calls, into a native iPhone app, and through Najimi Connect, a browser extension that connects X and Instagram in one click so what you follow becomes taste. Most of all, we want real groups planning real nights with it, to measure whether Qloo-grounded picks beat a generic assistant instead of assuming they do.

## Try it yourself

1. Open [najimi.xyz](https://najimi.xyz) on desktop or phone and tap **Start — it's free**. A guest can begin without an account.
2. Pick three different loves and adjust their weights. Open a “Why this?” chip on a pick to see the Qloo connection.
3. Open **People**, start a circle with a friend, and ask "@najimi find us a spot tonight": the card shows each member's fit. Then ask for a night out.
4. Try the feed, a pick's own sheet, Earth and the taste graph. Play a game.

Explore the [public code](https://github.com/Blockchain-Oracle/najimi), [product guide](https://docs.najimi.xyz/docs/guide), and [Qloo call map](https://docs.najimi.xyz/docs/qloo).
