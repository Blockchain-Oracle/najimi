"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { api } from "@/lib/fetcher"
import { PasteForm } from "./paste-form"

/** The landing's one action: no account needed — a guest session starts, then the reading does. */
export function StartForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <PasteForm
        busy={busy}
        onSite={async (url) => {
          setBusy(true)
          setError(null)
          try {
            const session = await authClient.getSession()
            if (!session.data) {
              const guest = await authClient.signIn.anonymous()
              if (guest.error) throw new Error("We couldn't start a session. Try again.")
            }
            const { businessId } = await api<{ businessId: string }>("/api/businesses", {
              json: { url },
            })
            router.push(`/b/${businessId}`)
          } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong")
            setBusy(false)
          }
        }}
      />
      {error ? <p className="text-sm text-text-2">{error}</p> : null}
    </div>
  )
}
