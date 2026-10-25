import {
  ArrowRight,
  BellRing,
  BookOpen,
  Boxes,
  Gamepad2,
  Globe,
  ImagePlus,
  type LucideIcon,
  Phone as PhoneIcon,
  Play,
  Route,
  Send,
  Sparkles,
  Vote,
  Waypoints,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { Diagram } from "@/components/diagram"
import { Stats } from "@/components/flow"
import { Tile } from "@/components/home/tile"
import { LogoCloud } from "@/components/logo-cloud"
import { Orb } from "@/components/orb"
import { Phone } from "@/components/phone"
import { QlooLogo } from "@/components/qloo-logo"
import { Run } from "@/components/run"
import { BRANDS } from "@/lib/brands"
import { DOCS, SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: { absolute: `${SITE.title}: ${SITE.tagline}` },
  alternates: { canonical: "/" },
}

const AURA_WASH =
  "radial-gradient(38% 50% at 22% 30%, color-mix(in oklab, var(--aura-1) 22%, transparent), transparent 70%), radial-gradient(36% 48% at 52% 12%, color-mix(in oklab, var(--aura-2) 20%, transparent), transparent 70%), radial-gradient(32% 46% at 80% 32%, color-mix(in oklab, var(--aura-3) 16%, transparent), transparent 70%)"

/** The phones under the title: real screens, fanned like a hand of cards. */
const FAN = [
  {
    src: "/shots/phone/m-film-trailer.webp",
    alt: "A film's sheet with its trailer ready to play",
    turn: "-rotate-[9deg] translate-y-10",
  },
  {
    src: "/shots/phone/m-feed.webp",
    alt: "The feed playing a song preview",
    turn: "-rotate-[4deg] translate-y-3",
  },
  {
    src: "/shots/phone/c-group-fit.webp",
    alt: "Najimi in a circle: five Lagos places, each scored for both friends",
    turn: "z-10 scale-[1.04]",
  },
  {
    src: "/shots/phone/c-plan.webp",
    alt: "A night around Lekki, planned",
    turn: "rotate-[4deg] translate-y-3",
  },
  {
    src: "/shots/phone/c-earth.webp",
    alt: "Earth over Lagos",
    turn: "rotate-[9deg] translate-y-10",
  },
] as const

/** One ask in a circle, from the message to the booked night (the README's worked example). */
const GROUP_TURN: { title: string; line: string }[] = [
  { title: "One line in the circle", line: "“@najimi find us a spot tonight.”" },
  {
    title: "Both tastes, blended",
    line: "Each friend's loves count the same in one Qloo ask for Lagos places.",
  },
  {
    title: "Each friend, scored",
    line: "The same five places go back to Qloo once per member: 74% for Juno, 74% for Kemi.",
  },
  {
    title: "Picked, routed, booked",
    line: "The reason in a line, then the night in order with an Uber per leg and a call to book on your yes.",
  },
]

const ACTIONS: { icon: LucideIcon; title: string; line: string; yes?: string }[] = [
  {
    icon: PhoneIcon,
    title: "Phones the venue",
    line: "An AI voice call to book your table, after you approve how it opens.",
    yes: "asks first",
  },
  { icon: Send, title: "Posts on X", line: "In your voice, from your account.", yes: "asks first" },
  {
    icon: Route,
    title: "Plans the night",
    line: "Every stop scored for every friend, routed, with shows.",
  },
  { icon: Vote, title: "Settles it", line: "Group fit for the circle, or a poll it can read." },
  { icon: Gamepad2, title: "Plays with you", line: "Deals a taste game, and plays along." },
  {
    icon: Globe,
    title: "Looks things up",
    line: "Hours, numbers, what's on, with the source named.",
  },
  { icon: ImagePlus, title: "Restyles your room", line: "Your real room, in your taste's words." },
  { icon: BellRing, title: "Follows up", line: "Call results, confirmations, how was it?" },
]

const SECTIONS: { icon: LucideIcon; title: string; line: string; href: string }[] = [
  { icon: BookOpen, title: "Guide", line: "What Najimi is, and every screen.", href: DOCS.start },
  {
    icon: Sparkles,
    title: "The agent",
    line: "Every tool, every action, every follow-up.",
    href: DOCS.agent,
  },
  {
    icon: Waypoints,
    title: "Qloo",
    line: "Every call, where you see it, and why.",
    href: DOCS.qloo,
  },
  {
    icon: Boxes,
    title: "Build",
    line: "Architecture, integrations, run it yourself.",
    href: DOCS.build,
  },
]

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[12px] tracking-wide text-fd-muted-foreground uppercase">
      {children}
    </p>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-[clamp(1.9rem,4.4vw,3rem)] leading-[1.02] font-extrabold tracking-[-0.025em]">
      {children}
    </h2>
  )
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col overflow-x-clip">
      {/* The promise */}
      <section className="relative isolate px-4 pt-16 pb-6 sm:pt-24">
        <div
          aria-hidden
          className="absolute inset-x-0 -top-24 -z-10 h-[38rem] blur-2xl"
          style={{ background: AURA_WASH }}
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Orb size={96} label="Najimi" />
          <h1 className="mt-7 font-display text-[clamp(2.6rem,7vw,5rem)] leading-[0.98] font-extrabold tracking-[-0.03em]">
            Your taste, made social, with an agent that plans for everyone.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-fd-muted-foreground sm:text-lg">
            Through Qloo, what you love becomes a feed, friends, games and a map, and an agent in
            every chat plans nights and trips for everyone's taste. These are its docs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={SITE.app}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-fd-primary px-6 text-[15px] font-semibold text-fd-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Open Najimi <ArrowRight className="size-4" />
            </a>
            <Link
              href={DOCS.start}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-fd-border bg-fd-background/60 px-6 text-[15px] font-semibold backdrop-blur transition-colors hover:bg-fd-accent"
            >
              Read the guide
            </Link>
            <a
              href={SITE.demo}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-fd-border bg-fd-background/60 px-6 text-[15px] font-semibold backdrop-blur transition-colors hover:bg-fd-accent"
            >
              <Play className="size-4" /> Watch the demo
            </a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-[13px] text-fd-muted-foreground">
            Built on <QlooLogo className="h-[1.05em] text-fd-foreground" /> · free, no account
            needed
          </p>
        </div>
      </section>

      {/* Real screens */}
      <section aria-label="The app" className="px-4 pb-10">
        <div className="mx-auto flex max-w-5xl items-start justify-center">
          {FAN.map((p, i) => (
            <div
              key={p.src}
              className={`-mx-3 w-[34%] shrink-0 transition-transform duration-500 sm:-mx-4 sm:w-[21%] ${p.turn} ${i === 0 || i === FAN.length - 1 ? "hidden sm:block" : ""}`}
            >
              <Phone src={p.src} alt={p.alt} eager />
            </div>
          ))}
        </div>
      </section>

      {/* What it works with */}
      <section aria-label="Works with" className="mx-auto w-full max-w-5xl px-4 pt-6 pb-16">
        <p className="mb-1 text-center text-[13px] text-fd-muted-foreground">
          Qloo at the core, with the services that make it playable and bookable
        </p>
        <LogoCloud brands={BRANDS} />
      </section>

      {/* One ask, two tastes */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <Kicker>Najimi in a circle</Kicker>
            <SectionTitle>One ask. Everyone's taste.</SectionTitle>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-fd-muted-foreground">
              Juno and Kemi share a circle. One of them asks; Najimi answers for both, with each
              person's fit on every pick.
            </p>
            <ol className="mt-8 flex flex-col gap-5">
              {GROUP_TURN.map((step, i) => (
                <li key={step.title} className="flex gap-3.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-fd-border bg-fd-background font-mono text-[12px]">
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{step.title}</span>
                    <span className="text-[14px] leading-snug text-fd-muted-foreground">
                      {step.line}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/docs/agent/turns"
              className="mt-9 inline-flex items-center gap-1.5 text-[15px] font-semibold underline-offset-4 hover:underline"
            >
              How a turn in a room works <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="mx-auto w-[72%] max-w-[18rem] lg:hidden">
            <Phone
              src="/shots/phone/c-group-fit.webp"
              alt="In the Friday crew circle, five Lagos places, each scored for Juno and for Kemi"
            />
          </div>
          <figure className="hidden overflow-hidden rounded-[18px] border border-fd-border bg-black shadow-[0_30px_80px_-40px_rgb(0_0_0/0.6)] lg:block">
            {/* biome-ignore lint/performance/noImgElement: a static export; the file is pre-sized */}
            <img
              src="/shots/wide/group-fit.webp"
              alt="In the Friday crew circle, “@najimi find us a spot tonight” returns five Lagos places, each scored for Juno and for Kemi"
              width={1600}
              height={1000}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </figure>
        </div>
      </section>

      {/* Everything is your taste */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="mb-10 max-w-2xl">
          <Kicker>One taste, every screen</Kicker>
          <SectionTitle>Three loves in. A whole world out.</SectionTitle>
          <p className="mt-4 text-[16px] leading-relaxed text-fd-muted-foreground">
            Pick three things you love. Qloo turns them into a taste across ten kinds of culture,
            and every screen is that taste, seen a different way, with the reason always one tap
            away.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Tile
            className="md:col-span-2 md:row-span-2"
            kind="phone"
            tall
            title="A feed that plays"
            line="Songs, trailers, episodes and places from your taste, most with the love they came from."
            href="/docs/guide/feed"
            src="/shots/phone/m-feed.webp"
            alt="The feed"
          />
          <Tile
            className="md:col-span-4"
            kind="wide"
            title="Earth"
            line="Your taste over a city, square by square. Tap one to read its scene."
            href="/docs/guide/earth"
            src="/shots/wide/earth-map.webp"
            alt="Earth over Lagos"
          />
          <Tile
            className="md:col-span-2"
            kind="phone"
            title="Games against Najimi"
            line="Qloo scores the hidden answers. Anyone can play a challenge link."
            href="/docs/guide/games"
            src="/shots/phone/l-game.webp"
            alt="Guess my wavelength"
          />
          <Tile
            className="md:col-span-2"
            kind="phone"
            title="Nights and trips"
            line="Routed, scored for every friend, with the hotel and the table a tap away."
            href="/docs/guide/plans"
            src="/shots/phone/c-plan.webp"
            alt="A night around Lekki"
          />
          <Tile
            className="md:col-span-3"
            kind="wide"
            title="Tap anything"
            line="One sheet for every film, song, book and place, playing right where you opened it."
            href="/docs/guide/things"
            src="/shots/wide/film-trailer.webp"
            alt="A film's sheet with its trailer"
          />
          <Tile
            className="md:col-span-3"
            kind="wide"
            title="Graph"
            line="Pull a love's weight and watch everything re-rank. Lay a friend's taste over yours."
            href="/docs/guide/graph"
            src="/shots/wide/taste-graph.webp"
            alt="The taste graph"
          />
          <Tile
            className="md:col-span-2"
            kind="wide"
            title="Business"
            line="Who your people are, and three moves for this week. Every move cites Qloo."
            href="/docs/guide/business"
            src="/shots/wide/business-recommendation.webp"
            alt="A business plan's move, ready to send"
          />
          <Tile
            className="md:col-span-2"
            kind="wide"
            title="Your feeds"
            line="Score your feed against your taste. On X and Instagram, Najimi follows your picks each morning."
            href="/docs/guide/feeds"
            src="/shots/wide/instagram-today.webp"
            alt="Your feeds on Instagram"
          />
          <Tile
            className="md:col-span-2"
            kind="phone"
            title="Stories, Passport, Wrapped"
            line="A photo with a song, a pick or a plan for a day; your year in five slides."
            href="/docs/guide/stories"
            src="/shots/wrapped/wrapped-1.webp"
            alt="A Wrapped slide: a year in taste"
          />
        </div>
      </section>

      {/* The agent */}
      <section className="relative isolate border-y border-fd-border bg-fd-card/40 px-4 py-24">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <Kicker>Najimi, the agent</Kicker>
            <SectionTitle>An agent that does the work, and shows it.</SectionTitle>
            <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-fd-muted-foreground">
              In your own chat, in every circle, and one tap away on every screen. It reads Qloo for
              every pick, shows each step as it works, and waits for your yes before anything real.
            </p>
            <ul className="mt-8 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {ACTIONS.map((a) => (
                <li key={a.title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border border-fd-border bg-fd-background">
                    <a.icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      {a.title}
                      {a.yes ? (
                        <span className="rounded-full border border-fd-border px-1.5 py-px font-mono text-[10px] font-normal text-fd-muted-foreground">
                          {a.yes}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[13.5px] leading-snug text-fd-muted-foreground">
                      {a.line}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link
              href={DOCS.agent}
              className="mt-9 inline-flex items-center gap-1.5 text-[15px] font-semibold underline-offset-4 hover:underline"
            >
              Everything the agent can do <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="lg:sticky lg:top-24">
            <Run
              ask="Three albums for a rainy evening, and why they fit me"
              steps={[
                {
                  icon: "tags",
                  label: "“rainy evening”",
                  meta: "qloo.tags · 3 tags · rainy night, downpour, rainy day",
                  qloo: true,
                },
                {
                  icon: "insights",
                  label: "Rainy-evening music for you",
                  meta: "qloo.insights · artist · rainy day · The Shins → 3",
                  qloo: true,
                },
                {
                  icon: "search",
                  label: "“TV on the Radio Return to Cookie Mountain”",
                  meta: "qloo.search · 1 found",
                  qloo: true,
                },
                {
                  icon: "search",
                  label: "“Paolo Nutini Caustic Love”",
                  meta: "qloo.search · 1 found",
                  qloo: true,
                },
                {
                  icon: "search",
                  label: "“The Killers Sam's Town”",
                  meta: "qloo.search · 1 found",
                  qloo: true,
                },
              ]}
            >
              <p>
                For you, I'd play these in order:{" "}
                <strong>Return To Cookie Mountain — TV on the Radio.</strong> …{" "}
                <strong>Caustic Love — Paolo Nutini.</strong> …{" "}
                <strong>Sam's Town — The Killers.</strong> The dramatic finish… Qloo connected the
                first two artists to your love of The Shins, and The Killers to your affinity for{" "}
                <em>The Social Network</em>.
              </p>
            </Run>
            <p className="-mt-4 text-center text-[12.5px] text-fd-muted-foreground">
              A real answer from the app, step for step.
            </p>
          </div>
        </div>
      </section>

      {/* Qloo */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <QlooLogo className="mb-6 h-10 text-fd-foreground sm:h-12" />
            <SectionTitle>Qloo, all the way down.</SectionTitle>
            <p className="mt-4 text-[16px] leading-relaxed text-fd-muted-foreground">
              Every pick, word, map, match and plan stop is a Qloo result. Picks are asked for with
              your loves as weighted signals and explainability on, so each one knows which love led
              to it. Every call is logged, and the one behind a pick, a chat card or your taste
              opens right where you see it.
            </p>
          </div>
          <Link
            href={DOCS.qloo}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-fd-border px-5 text-[14px] font-semibold transition-colors hover:bg-fd-accent lg:self-end"
          >
            Every Qloo call <ArrowRight className="size-4" />
          </Link>
        </div>
        <Stats
          items={[
            { value: "6", label: "Qloo endpoints, used for everything" },
            { value: "10", label: "kinds of culture in every taste" },
            { value: "5", label: "Qloo tools the agent composes freely" },
            { value: "19", label: "agent tools in all, with web search" },
          ]}
        />
      </section>

      {/* How it's built */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <Kicker>How it's built</Kicker>
            <SectionTitle>One taste engine under every screen.</SectionTitle>
            <p className="mt-4 text-[16px] leading-relaxed text-fd-muted-foreground">
              The web app takes the message; a worker runs Najimi's turn with its tools; Qloo
              answers every taste question; the result reaches everyone in the room live.
            </p>
          </div>
          <Link
            href={DOCS.build}
            className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-fd-border px-5 text-[14px] font-semibold transition-colors hover:bg-fd-accent lg:self-end"
          >
            The architecture <ArrowRight className="size-4" />
          </Link>
        </div>
        <Diagram
          name="system"
          alt="Najimi's system: friends on phones, the Next.js web app, the pg-boss worker running Najimi's turns, Postgres with live events and the Qloo call log, then Qloo, OpenAI and the services that play, route, book and call"
        />
      </section>

      {/* Where to go */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.title}
              href={s.href}
              className="group flex flex-col gap-3 rounded-[20px] border border-fd-border bg-fd-card p-5 transition-colors hover:border-[var(--line-strong)]"
            >
              <s.icon className="size-5" strokeWidth={1.75} />
              <span className="font-display text-[1.2rem] font-extrabold tracking-[-0.02em]">
                {s.title}
              </span>
              <span className="text-[14px] leading-snug text-fd-muted-foreground">{s.line}</span>
              <ArrowRight className="mt-auto size-4 text-fd-muted-foreground transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-fd-border px-4 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 text-[13px] text-fd-muted-foreground">
          <span className="flex items-center gap-2">
            <Orb size={18} /> Najimi, {SITE.meaning}. Made for the Qloo hackathon.
          </span>
          <span className="flex flex-wrap items-center gap-4">
            <a href={SITE.app} className="hover:text-fd-foreground">
              najimi.xyz
            </a>
            <a href={SITE.repo} className="hover:text-fd-foreground">
              GitHub (MIT)
            </a>
            <a href="/llms.txt" className="hover:text-fd-foreground">
              llms.txt
            </a>
            <span className="flex items-center gap-1.5">
              Built on <QlooLogo className="h-[1em] text-fd-foreground" />
            </span>
          </span>
        </div>
      </footer>
    </main>
  )
}
