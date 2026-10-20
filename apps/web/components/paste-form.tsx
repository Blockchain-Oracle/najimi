"use client"

import { Button } from "@najimi/ui/components/button"
import { Input } from "@najimi/ui/components/input"
import { useId, useState } from "react"

/** Accepts "joes.com", "www.joes.com" or a full URL, and returns a normalized https URL. */
export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (!url.hostname.includes(".")) return null
    return url.origin + (url.pathname === "/" ? "" : url.pathname)
  } catch {
    return null
  }
}

/** The whole first action: one field, one pill (design lock: Macaw's single field, DICE's pill). */
export function PasteForm({ onSite }: { onSite?: (url: string) => void }) {
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
      <Button type="submit" size="lg" className="sm:w-auto">
        Find my people
      </Button>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-text-2 sm:absolute sm:mt-14">
          {error}
        </p>
      ) : null}
    </form>
  )
}
