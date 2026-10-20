"use client"

import { Button } from "@najimi/ui/components/button"
import { Input } from "@najimi/ui/components/input"
import { useId, useState } from "react"
import { normalizeSiteUrl } from "@/lib/site-url"

/** The whole first action: one field, one pill (design lock: Macaw's single field, DICE's pill). */
export function PasteForm({
  onSite,
  busy = false,
}: {
  onSite?: (url: string) => void
  busy?: boolean
}) {
  const id = useId()
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        const url = normalizeSiteUrl(value)
        if (!url) {
          setError("That doesn't look like a website. Try something like yourplace.com")
          return
        }
        setError(null)
        onSite?.(url)
      }}
    >
      <label htmlFor={id} className="sr-only">
        Your website
      </label>
      <Input
        id={id}
        inputMode="url"
        autoComplete="url"
        placeholder="yourplace.com"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-12 rounded-pill px-6 text-base"
      />
      <Button type="submit" size="lg" className="sm:w-auto" disabled={busy}>
        {busy ? "Starting…" : "Find my people"}
      </Button>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-text-2 sm:absolute sm:mt-14">
          {error}
        </p>
      ) : null}
    </form>
  )
}
