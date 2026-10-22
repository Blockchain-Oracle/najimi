"use client"

import { LOOKS, type LookId } from "@najimi/config"
import { cn } from "@najimi/ui/lib/utils"
import { motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { sound } from "@/lib/sounds"

/*
 * "Who are you": the face you'll wear and the name Najimi greets you by. The card follows Kokonut
 * UI's Avatar Picker (21st.dev, @kokonutd/avatar-picker): a colour band, the chosen face large
 * with a spring turn when it changes, the row of faces with one ring that glides between them.
 * The faces and the "a look's name is a placeholder until you type yours" rule are OurSpaces'.
 */

export const LOOK_BG: Record<string, string> = {
  violet: "bg-violet",
  pink: "bg-pink",
  orange: "bg-orange",
  cobalt: "bg-cobalt",
  teal: "bg-teal",
  butter: "bg-butter",
}

export const lookSrc = (id: string) => `/looks/${id}.png`

export function LookCard({
  look,
  name,
  onLook,
  onName,
}: {
  look: LookId
  name: string
  onLook: (look: LookId) => void
  onName: (name: string) => void
}) {
  const t = useTranslations("Start")
  const [turns, setTurns] = useState(0)
  const current = LOOKS.find((l) => l.id === look) ?? LOOKS[0]
  const isPlaceholder = LOOKS.some((l) => l.name === name)

  const pick = (id: LookId) => {
    if (id === look) return
    const next = LOOKS.find((l) => l.id === id)
    setTurns((n) => n + 1)
    onLook(id)
    // A face's name is a placeholder the next face replaces; a name you typed is yours.
    if (next && (isPlaceholder || !name.trim())) onName(next.name)
    sound("tap")
  }

  return (
    <div className="overflow-hidden rounded-sheet bg-card text-card-foreground shadow-paper">
      <motion.div
        className={cn("h-28 transition-colors duration-500", LOOK_BG[current.identity])}
        initial={{ height: 0 }}
        animate={{ height: "7rem" }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
      <div className="-mt-20 flex flex-col items-center gap-5 px-6 pb-7">
        <motion.div
          key={current.id}
          className={cn(
            "size-36 overflow-hidden rounded-full ring-[6px] ring-card",
            LOOK_BG[current.identity],
          )}
          initial={{ scale: 0.6, rotate: turns % 2 ? -14 : 14, opacity: 0.4 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
        >
          {/* biome-ignore lint/performance/noImgElement: a static face from public/ */}
          <img src={lookSrc(current.id)} alt="" className="size-full object-cover" />
        </motion.div>

        <label className="flex w-full flex-col items-center gap-1">
          <span className="sr-only">{t("namePlaceholder")}</span>
          <input
            value={name}
            onChange={(e) => onName(e.target.value)}
            onFocus={(e) => (isPlaceholder ? e.target.select() : undefined)}
            maxLength={80}
            className="w-full bg-transparent text-center font-title text-4xl outline-none placeholder:text-paper-muted"
            placeholder={t("namePlaceholder")}
          />
          <span className="text-sm text-paper-muted">
            {isPlaceholder ? t("nameHint") : t("nameHello", { name: name.trim() })}
          </span>
        </label>

        <div
          className="flex flex-wrap justify-center gap-2.5 sm:gap-3"
          role="radiogroup"
          aria-label={t("lookLabel")}
        >
          {LOOKS.map((l) => {
            const selected = l.id === look
            return (
              <motion.button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={l.name}
                onClick={() => pick(l.id)}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.92 }}
                className={cn("relative size-10 rounded-full sm:size-12", LOOK_BG[l.identity])}
              >
                {/* biome-ignore lint/performance/noImgElement: a static face from public/ */}
                <img src={lookSrc(l.id)} alt="" className="size-full rounded-full object-cover" />
                {selected ? (
                  <motion.span
                    layoutId="look-ring"
                    className="absolute -inset-1.5 rounded-full ring-[3px] ring-paper-foreground"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                ) : null}
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
