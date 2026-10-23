/** Every word of the pitch deck, in one place: revise the pitch here. */
export const PITCH = [
  {
    id: "start",
    theme: "dark",
    label: "Start here",
    eyebrow: "Najimi · the pitch",
    title: "Your taste, made social.",
    body: "With an agent that plans for everyone. Juno and Kemi share a circle; one line in the chat, and every place comes back scored for both of them by Qloo.",
  },
  {
    id: "problem",
    theme: "light",
    label: "The problem",
    eyebrow: "The problem",
    title: "A group can't agree, so one feed decides.",
    body: "Planning together means guessing what your friends like. The loudest person picks, the rest go along, and nobody books it.",
  },
  {
    id: "product",
    theme: "dark",
    label: "Najimi",
    eyebrow: "The product",
    title: "An agent with taste in every chat.",
    body: "Through Qloo, what you love becomes a feed, friends, games and a map. In every chat Najimi plans nights and trips for everyone's taste, then calls the venue, books it and reminds you.",
  },
  {
    id: "how",
    theme: "light",
    label: "How it works",
    eyebrow: "How it works",
    title: "Qloo all the way down.",
    body: "Every recommendation is a Qloo result for these people. The agent plans, routes and acts on it; it never guesses a crowd-pleaser on its own.",
  },
  {
    id: "next",
    theme: "dark",
    label: "What's next",
    eyebrow: "After the hackathon",
    title: "We keep shipping.",
    body: "Everything in the demo is live on najimi.xyz today. Next, Najimi goes wherever people already plan together.",
  },
] as const

export const PROBLEM = [
  "01 · Whose taste?",
  "02 · Which place fits everyone?",
  "03 · Who books it?",
] as const

export const STEPS = [
  { label: "01 · Ask", text: "Say it in the chat, or out loud in a call." },
  { label: "02 · Score", text: "Qloo scores every pick for every person." },
  { label: "03 · Act", text: "Najimi calls the venue, books it and follows up." },
] as const

export const MILESTONES = [
  {
    label: "Now · live",
    text: "Feed, circles, games, Earth, plans, calls that book tables, and email.",
  },
  { label: "Next", text: "Najimi in Google Meet and Zoom calls, and a native iPhone app." },
  {
    label: "Then",
    text: "Najimi Connect: one-click X and Instagram, so your agents follow and like for you.",
  },
] as const
