import { HomeLayout } from "fumadocs-ui/layouts/home"
import Link from "next/link"
import { Orb } from "@/components/orb"
import { homeOptions } from "@/lib/layout.shared"
import { DOCS } from "@/lib/site"

/** A missing page (exported as 404.html, which nginx serves for anything it can't find). */
export default function NotFound() {
  return (
    <HomeLayout {...homeOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        <Orb size={64} />
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.02em]">Nothing here.</h1>
        <p className="max-w-sm text-fd-muted-foreground">
          This page moved or never existed. The docs start at the guide.
        </p>
        <Link
          href={DOCS.start}
          className="inline-flex h-11 items-center rounded-full bg-fd-primary px-5 text-[14px] font-semibold text-fd-primary-foreground"
        >
          Go to the guide
        </Link>
      </main>
    </HomeLayout>
  )
}
