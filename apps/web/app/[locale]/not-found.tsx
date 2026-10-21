import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="font-title text-title-sm">Nothing here.</h1>
      <Link href="/" className="sticker px-4 py-2 text-sm font-semibold">
        Najimi
      </Link>
    </main>
  )
}
