<h1 align="center">Najimi · 馴染み</h1>
<p align="center">Find your people by what you love.</p>

<p align="center">
  <a href="https://najimi.84.46.247.92.sslip.io"><b>Open Najimi</b></a>
  &nbsp;·&nbsp;
  <a href="https://najimi-docs.84.46.247.92.sslip.io"><b>Documentation</b></a>
  &nbsp;·&nbsp;
  <a href="https://najimi-docs.84.46.247.92.sslip.io/qloo"><b>How it uses Qloo</b></a>
</p>

**Najimi is a social app where your taste is your identity.** Tell it a few things you love: an artist, a show, a book, a place. [Qloo](https://www.qloo.com)'s taste graph turns them into a taste that reaches music, film, TV, books, podcasts, brands, places, destinations and people, and every pick names the love behind it. An AI agent works from that taste with the whole Qloo surface as its tools.

Built for the **[Qloo Agentic Hackathon](https://qloo.devpost.com/)**. *Najimi* (馴染み) means **someone you know well**.

## Where it's going

Najimi is being built stage by stage around one idea: one taste profile, owned by a person, a circle of friends, a business or a neighbourhood, and every screen a different view of it.

- **Feed:** reels of music and culture ranked by your taste, with the dials of the algorithm in your hands.
- **Circles:** group chats with the agent inside, which shows what you share, plans the night or the trip, and books it.
- **Games:** guess each other's taste, blind tastings Qloo predicts, a daily drop and leaderboards.
- **Earth:** a globe of where people with your taste are, down to the neighbourhood.
- **The graph:** your taste as a living graph you can pull, expand and replay.
- **Your socials:** what you follow becomes taste, and your taste tunes what your feeds show you.
- **Business mode:** who your customers are, what else they love, and what to do next.

## What's live today

- **Sign-up and your taste:** a face, a name, three or more loves with weights, and a live reveal of your taste words and picks in every domain, each with a **because** chip.
- **The agent:** a chat that composes Qloo's tools per ask (picks of any kind, taste words, a city heatmap, demographic lean, comparisons) and shows every step it took above its answer. It can restyle a photo of a room to your taste.
- **Sharing, twelve languages, settings** with today's allowance and *Delete all my data*.

## How Najimi uses Qloo

| Tool | Qloo endpoint | Used for |
| --- | --- | --- |
| `qlooSearch` | `/search` | Turning a name ("Fela", "Kyoto") into an id to use as a signal or filter |
| `qlooTags` | `/v2/tags` | Moods, genres, cuisines and place kinds by meaning |
| `qlooInsights` | `/v2/insights` | Picks of any type, a taste's words, a city **heatmap**, the **demographic** lean, with every documented signal and filter |
| `qlooCompare` | `/v2/analysis/compare` | Two tastes side by side |
| `qlooAudiences` | `/v2/audiences` | Audiences to lean a taste with (never political ones) |

Loves go in as weighted signals (`{ id, weight }`), and Qloo's explainability names the love behind each result. Every Qloo card has a **Qloo** chip that opens the exact request. More in the [Qloo page of the docs](https://najimi-docs.84.46.247.92.sslip.io/qloo).

## Architecture

A pnpm and Turborepo monorepo: a Next.js 16 web app, a pg-boss worker, Postgres 17, RustFS (S3) for media, and a Fumadocs site, each a container on Coolify. Live updates go from the worker through Postgres `LISTEN/NOTIFY` to pages as server-sent events. The [architecture page](https://najimi-docs.84.46.247.92.sslip.io/architecture) has the diagrams.

| Path | What |
| --- | --- |
| [`apps/web`](apps/web) | Pages, API routes, the chat route, cards, link previews |
| [`apps/worker`](apps/worker) | Taste reveal, image jobs, titles, the nightly guest sweep; runs migrations |
| [`apps/docs`](apps/docs) | The documentation site |
| [`packages/agent`](packages/agent) | Model registry, tools, rules |
| [`packages/qloo`](packages/qloo) | Qloo client: caching, de-duplication, call log, taste helpers |
| [`packages/db`](packages/db) | Drizzle schema and migrations; moving a guest's data on sign-in; deleting a person's data |
| [`packages/media`](packages/media), [`sources`](packages/sources), [`storage`](packages/storage) | Image providers; safe fetching and caching of outside pages; S3 and signed media links |
| [`packages/config`](packages/config), [`env`](packages/env), [`jobs`](packages/jobs), [`live`](packages/live), [`email`](packages/email), [`tokens`](packages/tokens), [`ui`](packages/ui) | Every tunable, typed env, queues, live events, email codes, design tokens, components |

## Run it locally

You need Node 22.18 or later (24 is used), pnpm 11 and Docker.

```bash
cp .env.example .env    # fill in QLOO_API_KEY and OPENAI_API_KEY at least
pnpm install
pnpm services:up        # Postgres and RustFS
pnpm dev                # web on :3310, docs on :3311, the worker (migrates on start)
```

`pnpm run ci` runs the linter, type checks and production builds.

## Provenance

- **Qloo** data comes from the hackathon API (`hackathon.api.qloo.com`). Entity artwork is Qloo's.
- **Map tiles** © OpenStreetMap contributors; the sign-up map uses [OpenFreeMap](https://openfreemap.org)'s dark style (© OpenMapTiles) with [MapLibre GL JS](https://maplibre.org) (BSD-3-Clause).
- **Faces** at sign-up are from [OurSpaces](https://github.com/thomasnguyen/ourspaces-app) (MIT, © 2026 Thomas Nguyen); **interface sounds** are from [Mixkit](https://mixkit.co/free-sound-effects/) under the [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree).
- **Components** adapted from [21st.dev](https://21st.dev).
- **Sample rooms** in [`apps/worker/samples`](apps/worker/samples) were generated for this project with an image model; they show no real home.
- Written by Abu with Claude Code.

## License

[MIT](LICENSE).
