"use client"

import { toast } from "@najimi/ui/components/sonner"
import { Switch } from "@najimi/ui/components/switch"
import { cn } from "@najimi/ui/lib/utils"
import { Globe, Loader2, Lock, Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { api } from "@/lib/fetcher"

type Visibility = "public" | "friends" | "private"

const field =
  "w-full rounded-tile bg-background px-3.5 py-3 text-[15px] text-foreground outline-none ring-1 ring-border placeholder:text-text-4 focus:ring-2 focus:ring-ring"

/**
 * Who you are to everyone else: your name, a line about you, your city (it decides places and the
 * map; a new one recomputes them), and who sees your taste. Used by Settings and Edit profile.
 */
export function ProfileForm({
  person,
  onRun,
  part = "all",
}: {
  person: {
    id: string
    name: string
    city: string | null
    bio: string | null
    visibility: Visibility
    /** Settings shows the radar switch; the profile's own edit sheet doesn't. */
    radar?: boolean
  }
  onRun?: (runId: string) => void
  /** Settings opens "about you" and "who sees your taste" as two rows; elsewhere it's all one. */
  part?: "all" | "about" | "privacy"
}) {
  const about = part !== "privacy"
  const privacy = part !== "about"
  const t = useTranslations("Profile")
  const router = useRouter()
  const [name, setName] = useState(person.name)
  const [bio, setBio] = useState(person.bio ?? "")
  const [city, setCity] = useState(person.city ?? "")
  const [visibility, setVisibility] = useState<Visibility>(person.visibility)
  const [radar, setRadar] = useState(person.radar ?? false)
  const [saving, setSaving] = useState(false)
  const changed =
    name.trim() !== person.name ||
    bio.trim() !== (person.bio ?? "") ||
    city.trim() !== (person.city ?? "") ||
    visibility !== person.visibility ||
    (person.radar !== undefined && radar !== person.radar)

  async function save() {
    setSaving(true)
    try {
      const { runId } = await api<{ runId: string | null }>(`/api/people/${person.id}`, {
        method: "PATCH",
        json: {
          name: name.trim(),
          bio: bio.trim() || null,
          city: city.trim() || null,
          visibility,
          ...(person.radar !== undefined ? { radar } : {}),
        },
      })
      if (runId) onRun?.(runId)
      toast(t("saved"))
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "")
    } finally {
      setSaving(false)
    }
  }

  const options: { value: Visibility; icon: typeof Globe; label: string; hint: string }[] = [
    { value: "public", icon: Globe, label: t("public"), hint: t("publicHint") },
    { value: "friends", icon: Users, label: t("friends"), hint: t("friendsHint") },
    { value: "private", icon: Lock, label: t("private"), hint: t("privateHint") },
  ]

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (changed && name.trim()) void save()
      }}
      className="flex flex-col gap-4"
    >
      {about ? (
        <>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-text-2">
            {t("name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-text-2">
            {t("bio")}
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              placeholder={t("bioHint")}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-text-2">
            {t("city")}
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={120}
              className={field}
            />
          </label>
        </>
      ) : null}
      {privacy ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend
              className={cn(
                "mb-1.5 text-[13px] font-semibold text-text-2",
                part === "privacy" && "sr-only",
              )}
            >
              {t("whoSees")}
            </legend>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={visibility === o.value}
                onClick={() => setVisibility(o.value)}
                className={cn(
                  "flex items-center gap-3 rounded-tile px-3.5 py-3 text-start ring-1 transition-colors",
                  visibility === o.value
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-background ring-border",
                )}
              >
                <o.icon className="size-5 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{o.label}</span>
                  <span
                    className={cn(
                      "text-[13px]",
                      visibility === o.value ? "opacity-75" : "text-text-3",
                    )}
                  >
                    {o.hint}
                  </span>
                </span>
              </button>
            ))}
          </fieldset>
          {person.radar !== undefined ? (
            <div className="flex items-center justify-between gap-4 rounded-tile bg-background px-3.5 py-3 ring-1 ring-border">
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{t("radar")}</span>
                <span className="text-[13px] text-text-3">{t("radarHint")}</span>
              </span>
              <Switch checked={radar} onCheckedChange={setRadar} aria-label={t("radar")} />
            </div>
          ) : null}
        </>
      ) : null}
      <button
        type="submit"
        disabled={!changed || !name.trim() || saving}
        className="h-12 rounded-pill bg-primary text-[15px] font-semibold text-primary-foreground transition-opacity disabled:opacity-30"
      >
        {saving ? <Loader2 className="mx-auto size-5 animate-spin" /> : t("save")}
      </button>
    </form>
  )
}
