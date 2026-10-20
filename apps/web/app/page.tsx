import { APP } from "@najimi/config"
import { PasteForm } from "@/components/paste-form"

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-6 pb-16">
      <header className="flex h-16 items-center justify-between">
        <span className="text-sm font-bold uppercase">{APP.name}</span>
      </header>
      <section className="flex flex-1 flex-col justify-center gap-10 py-16">
        <h1 className="font-display-poster text-display-sm sm:text-display lg:text-display-lg">
          Find
          <br />
          your
          <br />
          people.
        </h1>
        <p className="max-w-xl text-base text-text-2">
          Paste your website. Najimi asks Qloo who your people are — what else they love and where
          they are — then goes and gets them, one approval at a time.
        </p>
        <PasteForm />
      </section>
    </main>
  )
}
