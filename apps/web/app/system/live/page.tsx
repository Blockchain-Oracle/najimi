import { notFound } from "next/navigation"
import { LiveCheck } from "./live-check"

/** Development check of the live pipe (web → queue → worker → NOTIFY → SSE → this page). */
export default function LivePage() {
  if (process.env.NODE_ENV === "production") notFound()
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col justify-center gap-6 px-6">
      <h1 className="text-xl font-bold uppercase">Live pipe</h1>
      <LiveCheck />
    </main>
  )
}
