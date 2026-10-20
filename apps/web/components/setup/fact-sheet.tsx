"use client"

import { Button } from "@najimi/ui/components/button"
import { Input } from "@najimi/ui/components/input"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { api } from "@/lib/fetcher"
import { qk } from "@/lib/query-keys"

export type Fact = {
  id: string
  label: string
  value: string
  sourceUrl: string | null
  origin: "site" | "owner"
}

const pathOf = (url: string | null) => {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.pathname === "/" ? u.hostname.replace(/^www\./, "") : u.pathname
  } catch {
    return null
  }
}

function FactForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: { label: string; value: string }
  onSave: (fact: { label: string; value: string }) => void
  onCancel: () => void
  saving: boolean
}) {
  const [label, setLabel] = useState(initial?.label ?? "")
  const [value, setValue] = useState(initial?.value ?? "")
  return (
    <form
      className="flex flex-col gap-2 py-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        if (label.trim() && value.trim()) onSave({ label: label.trim(), value: value.trim() })
      }}
    >
      <Input
        aria-label="What it is"
        placeholder="Opening hours"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="sm:w-44"
      />
      <Input
        aria-label="The fact"
        placeholder="Tue–Sun, 6pm–1am"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Save fact
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

/**
 * The fact sheet (F10): what the site says, each with the page it came from. Agents may use only
 * these as product facts, so the owner corrects, adds and removes them here.
 */
export function FactSheet({ businessId, facts }: { businessId: string; facts: Fact[] }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.business(businessId) })

  const save = useMutation({
    mutationFn: (input: { id?: string; label: string; value: string }) =>
      input.id
        ? api(`/api/businesses/${businessId}/facts/${input.id}`, {
            method: "PATCH",
            json: { label: input.label, value: input.value },
          })
        : api(`/api/businesses/${businessId}/facts`, {
            json: { label: input.label, value: input.value },
          }),
    onSuccess: () => {
      setEditing(null)
      setAdding(false)
      return refresh()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/api/businesses/${businessId}/facts/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  })

  return (
    <section aria-labelledby="facts-title" className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-foreground pb-2">
        <h2 id="facts-title" className="text-xs font-bold uppercase">
          Fact sheet
        </h2>
        <span className="text-xs text-text-3">Agents only use what's here</span>
      </div>
      {facts.length === 0 && !adding ? (
        <p className="py-4 text-sm text-text-2">
          Nothing stated on the site yet. Add what customers should know.
        </p>
      ) : null}
      <ul>
        {facts.map((fact) =>
          editing === fact.id ? (
            <li key={fact.id} className="border-b border-border">
              <FactForm
                initial={fact}
                saving={save.isPending}
                onCancel={() => setEditing(null)}
                onSave={(f) => save.mutate({ id: fact.id, ...f })}
              />
            </li>
          ) : (
            <li
              key={fact.id}
              className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-start gap-3 border-b border-border py-3 text-sm"
            >
              <span className="text-text-3">{fact.label}</span>
              <span className="min-w-0">
                <span className="text-foreground">{fact.value}</span>
                <span className="mt-1 block text-xs text-text-3">
                  {fact.origin === "owner"
                    ? "Added by you"
                    : pathOf(fact.sourceUrl)
                      ? `From ${pathOf(fact.sourceUrl)}`
                      : "From your site"}
                </span>
              </span>
              <span className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Edit ${fact.label}`}
                  onClick={() => setEditing(fact.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove ${fact.label}`}
                  onClick={() => remove.mutate(fact.id)}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ),
        )}
      </ul>
      {adding ? (
        <FactForm
          saving={save.isPending}
          onCancel={() => setAdding(false)}
          onSave={(f) => save.mutate(f)}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 self-start"
          onClick={() => setAdding(true)}
        >
          <Plus data-icon="inline-start" />
          Add a fact
        </Button>
      )}
      {save.error || remove.error ? (
        <p className="mt-2 text-sm text-text-2">{(save.error ?? remove.error)?.message}</p>
      ) : null}
    </section>
  )
}
