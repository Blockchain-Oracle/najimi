"use client"

import type { CallNote } from "@najimi/agent"
import { Orb } from "@najimi/ui/components/orb"
import { Phone } from "lucide-react"
import { useTranslations } from "next-intl"

/*
 * A call in the room, as a card: while it's going, who started it and Join; once it's over, how
 * long it ran and, when Najimi was in it, what it heard and found.
 */
export function RoomCallNotice({
  note,
  text,
  onJoin,
}: {
  note: CallNote
  text: string
  onJoin?: () => void
}) {
  const t = useTranslations("Call")
  return (
    <section className="dark mx-auto flex w-full max-w-md flex-col gap-3 rounded-card bg-[#0b0b0d] p-4 text-foreground ring-1 ring-white/10">
      <div className="flex items-center gap-3">
        {note.najimi ? (
          <Orb size={40} working={note.live} />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8">
            <Phone className="size-4" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-heading text-[15px]">{text}</span>
          <span className="text-[13px] text-text-3">
            {note.live ? (note.najimi ? t("liveWithNajimi") : t("live")) : t("over")}
          </span>
        </span>
        {note.live && onJoin ? (
          <button
            type="button"
            onClick={onJoin}
            className="flex h-10 items-center gap-1.5 rounded-pill bg-success px-4 text-[14px] font-semibold text-white"
          >
            <Phone className="size-4" /> {t("join")}
          </button>
        ) : null}
      </div>
      {note.summary ? (
        <p className="border-t border-white/10 pt-3 text-[14px] leading-relaxed text-text-2">
          {note.summary}
        </p>
      ) : null}
    </section>
  )
}
