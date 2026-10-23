import { APP } from "@najimi/config"
import { ArrowRight, ArrowUpRight, Play } from "lucide-react"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { pageLocale } from "@/lib/page-locale"

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Najimi in three minutes: one ask in a circle, every friend scored by Qloo, and a night that books itself.",
  openGraph: { images: ["/demo/cover.png"] },
  twitter: { card: "summary_large_image", images: ["/demo/cover.png"] },
}

/** The demo film's YouTube id once it's recorded; until then the page leads with the live app. */
const FILM: string | null = null

/** The judge's path through the live app, each step opening that screen. */
const STEPS = [
  {
    title: "Start with three loves",
    text: "Pick a few things you love (or bring your YouTube). Qloo reads your taste in seconds.",
    image: "/demo/people.webp",
    href: "/start",
    open: "Start",
  },
  {
    title: "Your feed plays",
    text: "Songs, trailers, episodes and places from your taste, each with why it's here.",
    image: "/demo/feed.webp",
    href: "/feed",
    open: "Open the feed",
  },
  {
    title: "Ask in a circle",
    text: "Join the Najimi Lounge and write: “Najimi, find us a spot tonight.” Every place comes back scored for each person.",
    image: "/demo/group-fit-phone.webp",
    href: "/join/najimilounge",
    open: "Join the Lounge",
  },
  {
    title: "The night plans itself",
    text: "A route with each stop's fit, Uber between them, and Najimi phones the venue to book the table.",
    image: "/demo/plan.webp",
    href: `${APP.docs}/docs/guide/plans`,
    open: "See how plans work",
  },
  {
    title: "Your people on Earth",
    text: "Spin to your city and see where people with your taste are, street by street.",
    image: "/demo/earth.webp",
    href: "/earth",
    open: "Open Earth",
  },
  {
    title: "Play your taste",
    text: "Guess my wavelength against Najimi, then send it to a friend; the board keeps score.",
    image: "/demo/game.webp",
    href: "/people",
    open: "Play",
  },
  {
    title: "Run a business on it",
    text: "“I run a café in Yaba” becomes a plan: who your people are, three moves this week.",
    image: "/demo/business.webp",
    href: "/business",
    open: "Try business",
  },
] as const

export default async function DemoPage({ params }: { params: Promise<{ locale: string }> }) {
  await pageLocale(params)
  return (
    <div className="dark min-h-dvh bg-background text-foreground [color-scheme:dark]">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5">
        <Link href="/" className="font-title text-[22px] leading-none">
          najimi
        </Link>
        <nav className="flex items-center gap-4 text-[14px]">
          <Link href="/pitch" className="text-text-2 hover:text-foreground">
            Pitch
          </Link>
          {APP.docs ? (
            <a href={APP.docs} className="text-text-2 hover:text-foreground">
              Docs
            </a>
          ) : null}
          <Link
            href="/start"
            className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-foreground px-4 font-semibold text-background"
          >
            Start <ArrowRight className="size-4" />
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-5 pt-8 pb-24">
        <section className="flex flex-col gap-6">
          <p className="text-[12px] font-bold tracking-[0.12em] text-text-3 uppercase">The demo</p>
          <h1 className="max-w-3xl font-title text-[2.6rem] leading-[1.04] tracking-[-0.02em] md:text-[4rem]">
            One ask. Everyone's taste.
          </h1>
          <p className="max-w-2xl text-[17px] leading-relaxed text-text-2">
            Juno and Kemi share a circle. One line, and Najimi answers with places Qloo scored for
            both of them, plans the night, and phones the venue to book it.
          </p>
          <div className="overflow-hidden rounded-card ring-1 ring-white/10">
            {FILM ? (
              <iframe
                className="aspect-video w-full"
                src={`https://www.youtube-nocookie.com/embed/${FILM}`}
                title="Najimi demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <Link href="/join/najimilounge" className="group block">
                {/* The phone sees the phone capture; wider screens the desktop one. */}
                <Image
                  src="/demo/group-fit-phone.webp"
                  alt="Najimi in a circle: places for tonight, each with Juno's and Kemi's fit from Qloo"
                  width={780}
                  height={1688}
                  priority
                  className="h-[30rem] w-full object-cover object-top md:hidden"
                />
                <Image
                  src="/demo/group-fit.webp"
                  alt="Najimi in a circle: places for tonight, each with Juno's and Kemi's fit from Qloo"
                  width={1600}
                  height={1000}
                  priority
                  className="hidden h-auto w-full transition-transform duration-500 group-hover:scale-[1.01] md:block"
                />
                <span className="flex items-center gap-3 border-t border-white/10 bg-card px-5 py-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-black">
                    <Play className="size-5 translate-x-px" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-heading text-[16px]">
                      Try it live in the Najimi Lounge
                    </span>
                    <span className="text-[13px] text-text-3">
                      The demo film is being recorded; the app is live now.
                    </span>
                  </span>
                </span>
              </Link>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="font-title text-[1.9rem] leading-tight">Follow it yourself</h2>
          <ol className="grid gap-4 md:grid-cols-2">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 overflow-hidden rounded-card bg-card p-4 ring-1 ring-white/8"
              >
                <Image
                  src={step.image}
                  alt=""
                  width={560}
                  height={1212}
                  className="h-40 w-[4.6rem] shrink-0 rounded-tile object-cover object-top ring-1 ring-white/10"
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="tnum text-[12px] font-bold text-text-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-heading text-[17px]">{step.title}</h3>
                  <p className="text-[14px] leading-relaxed text-text-2">{step.text}</p>
                  <a
                    href={step.href}
                    className="mt-auto inline-flex items-center gap-1 pt-1 text-[14px] font-semibold hover:underline"
                  >
                    {step.open} <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  )
}
