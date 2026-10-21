import { APP } from "@najimi/config"

/** Interim landing while the taste copilot is built stage by stage; the real one comes at launch. */
export default function Landing() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 pb-16">
      <header className="flex h-16 items-center justify-between">
        <span className="text-sm font-bold uppercase">{APP.name}</span>
      </header>
      <section className="flex flex-1 flex-col justify-center gap-10 py-16">
        <h1 className="font-display-poster text-display-sm sm:text-display lg:text-display-lg">
          The taste
          <br />
          copilot.
        </h1>
        <p className="max-w-xl text-base text-text-2">
          Tell Najimi what you love. It makes things for your real life that fit you — your room
          relit, dinner for your mum, your next book — and shows the Qloo taste data behind every
          choice.
        </p>
        <p className="text-sm font-bold uppercase text-text-3">Coming together, stage by stage.</p>
      </section>
    </main>
  )
}
