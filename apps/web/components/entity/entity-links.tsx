"use client"

import { cn } from "@najimi/ui/lib/utils"
import { BookOpen, Car, Clock, Globe, MapPin, Navigation, Phone, Play, Star } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import {
  type SimpleIcon,
  siGoodreads,
  siGoogle,
  siImdb,
  siInstagram,
  siLetterboxd,
  siSpotify,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import { type EntityDetails, openingToday } from "@/lib/entity"
import { uberLink } from "@/lib/rides"

/*
 * Where a thing leads, by kind, under the entity sheet's stage. A place: a pill row after Google
 * Maps' place sheet (Refero d81cff6d: Directions first and filled, then the rest), today's hours,
 * the address. A film or show: where to watch it (JustWatch's data, credited), more videos that
 * play in the stage, and what people say on TikTok, YouTube and Instagram. Anyone with accounts
 * (artists, brands, films): their accounts.
 */

function Pill({
  href,
  icon,
  brand,
  label,
  primary = false,
}: {
  href: string
  icon?: ReactNode
  brand?: SimpleIcon
  label: string
  primary?: boolean
}) {
  return (
    <a
      href={href}
      target={href.startsWith("tel:") ? undefined : "_blank"}
      rel="noreferrer"
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-pill px-4 text-[14px] font-semibold transition-colors",
        primary
          ? "bg-white text-black hover:bg-white/90"
          : "bg-white/[0.08] text-white hover:bg-white/[0.14]",
      )}
    >
      {brand ? <BrandIcon icon={brand} className="size-4" /> : icon}
      {label}
    </a>
  )
}

const Row = ({ children }: { children: ReactNode }) => (
  <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
    {children}
  </div>
)

export function PlaceLinks({
  name,
  place,
}: {
  name: string
  place: NonNullable<EntityDetails["place"]>
}) {
  const t = useTranslations("Entity")
  const today = openingToday(place.hours)
  const uber =
    place.lat != null && place.lon != null
      ? uberLink([{ lat: place.lat, lon: place.lon, name, address: place.address }])
      : null
  return (
    <section className="flex flex-col gap-3">
      <Row>
        <Pill
          href={place.directions}
          icon={<Navigation className="size-4" />}
          label={t("directions")}
          primary
        />
        {uber ? <Pill href={uber} icon={<Car className="size-4" />} label="Uber" /> : null}
        {place.phone ? (
          <Pill href={`tel:${place.phone}`} icon={<Phone className="size-4" />} label={t("call")} />
        ) : null}
        {place.website ? (
          <Pill href={place.website} icon={<Globe className="size-4" />} label={t("website")} />
        ) : null}
        {place.instagram ? (
          <Pill
            href={`https://www.instagram.com/${place.instagram}/`}
            brand={siInstagram}
            label="Instagram"
          />
        ) : null}
        {place.tiktok ? (
          <Pill href={`https://www.tiktok.com/@${place.tiktok}`} brand={siTiktok} label="TikTok" />
        ) : null}
        <Pill href={place.maps} brand={siGoogle} label={t("maps")} />
      </Row>
      <div className="flex flex-col gap-1.5 text-[14px] text-white/70">
        {today ? (
          <span className="flex items-center gap-2">
            <Clock className="size-4 shrink-0" />
            <span
              className={
                today.open ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"
              }
            >
              {today.open ? t("openNow") : t("closedNow")}
            </span>
            {today.open && today.until ? <span>{t("until", { time: today.until })}</span> : null}
            {!today.open && today.from ? <span>{t("opensAt", { time: today.from })}</span> : null}
          </span>
        ) : null}
        {place.address ? (
          <span className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" /> <span className="truncate">{place.address}</span>
          </span>
        ) : null}
        {place.rating != null || place.price != null ? (
          <span className="flex items-center gap-3">
            {place.rating != null ? (
              <span className="flex items-center gap-1">
                <Star className="size-4 shrink-0 fill-current text-amber-300" />{" "}
                {place.rating.toFixed(1)}
              </span>
            ) : null}
            {place.price != null ? (
              <span>{"$".repeat(Math.max(1, Math.min(4, place.price)))}</span>
            ) : null}
          </span>
        ) : null}
      </div>
    </section>
  )
}

export function FilmLinks({
  film,
  talk,
  instagram,
  onPlay,
}: {
  film: NonNullable<EntityDetails["film"]>
  talk: EntityDetails["talk"]
  instagram: string | null
  onPlay: (video: { youtube: string; title: string }) => void
}) {
  const t = useTranslations("Entity")
  return (
    <section className="flex flex-col gap-5">
      {film.providers.length ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">
            {t("whereToWatch")}
          </h3>
          <Row>
            {film.providers.map((p) => (
              <a
                key={p.name}
                href={film.watchLink ?? "#"}
                target="_blank"
                rel="noreferrer"
                title={p.name}
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                {p.logo ? (
                  // biome-ignore lint/performance/noImgElement: the service's own logo (TMDB)
                  <img src={p.logo} alt={p.name} className="size-12 rounded-[12px] object-cover" />
                ) : (
                  <span className="grid size-12 place-items-center rounded-[12px] bg-white/10 text-[11px]">
                    {p.name.slice(0, 2)}
                  </span>
                )}
                <span className="text-[11px] text-white/55">{t(`provider.${p.kind}`)}</span>
              </a>
            ))}
          </Row>
          {film.watchLink ? (
            <a
              href={film.watchLink}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-white/45 hover:text-white/70"
            >
              {t("justwatch")}
            </a>
          ) : null}
        </div>
      ) : null}

      {film.videos.length ? (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">
            {t("moreVideos")}
          </h3>
          <Row>
            {film.videos.map((v) => (
              <button
                key={v.youtube}
                type="button"
                onClick={() => onPlay(v)}
                className="group flex w-44 shrink-0 flex-col gap-1.5 text-start"
              >
                <span className="relative block aspect-video overflow-hidden rounded-tile bg-black">
                  {/* biome-ignore lint/performance/noImgElement: YouTube's own still */}
                  <img
                    src={`https://i.ytimg.com/vi/${v.youtube}/mqdefault.jpg`}
                    alt=""
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid size-9 place-items-center rounded-full bg-black/50 ring-1 ring-white/30 backdrop-blur">
                      <Play className="ms-0.5 size-4 fill-white text-white" />
                    </span>
                  </span>
                </span>
                <span className="line-clamp-2 text-[12px] leading-snug text-white/75">
                  {v.title}
                </span>
              </button>
            ))}
          </Row>
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">
          {t("whatPeopleSay")}
        </h3>
        <Row>
          <Pill href={talk.tiktok} brand={siTiktok} label="TikTok" />
          <Pill href={talk.youtube} brand={siYoutube} label="YouTube" />
          {instagram ? (
            <Pill
              href={`https://www.instagram.com/${instagram}/`}
              brand={siInstagram}
              label="Instagram"
            />
          ) : null}
          {film.letterboxd ? (
            <Pill href={film.letterboxd} brand={siLetterboxd} label="Letterboxd" />
          ) : null}
          {film.imdb ? <Pill href={film.imdb} brand={siImdb} label="IMDb" /> : null}
        </Row>
      </div>
    </section>
  )
}

/** An artist's, brand's or anyone's accounts, and where people talk about them. */
export function AccountLinks({ details, isArtist }: { details: EntityDetails; isArtist: boolean }) {
  const t = useTranslations("Entity")
  const a = details.accounts
  const spotify = details.links.spotify ?? null
  if (!a.instagram && !a.x && !a.tiktok && !a.website && !spotify && !isArtist) return null
  return (
    <Row>
      {spotify ? <Pill href={spotify} brand={siSpotify} label="Spotify" /> : null}
      {a.instagram ? (
        <Pill
          href={`https://www.instagram.com/${a.instagram}/`}
          brand={siInstagram}
          label="Instagram"
        />
      ) : null}
      {a.tiktok ? (
        <Pill href={`https://www.tiktok.com/@${a.tiktok}`} brand={siTiktok} label="TikTok" />
      ) : (
        <Pill href={details.talk.tiktok} brand={siTiktok} label="TikTok" />
      )}
      {a.x ? <Pill href={`https://x.com/${a.x}`} brand={siX} label="X" /> : null}
      {isArtist ? <Pill href={details.talk.youtube} brand={siYoutube} label="YouTube" /> : null}
      {a.website ? (
        <Pill href={a.website} icon={<Globe className="size-4" />} label={t("website")} />
      ) : null}
    </Row>
  )
}

/** An artist's next concerts, each straight to its tickets (Ticketmaster). */
export function TourLinks({ tour }: { tour: EntityDetails["tour"] }) {
  const t = useTranslations("Entity")
  const format = useFormatter()
  if (!tour.length) return null
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">
        {t("onTour")}
      </h3>
      <ul className="flex flex-col divide-y divide-white/[0.06] overflow-hidden rounded-tile bg-white/[0.05]">
        {tour.map((d) => {
          const day = d.localDate ? new Date(`${d.localDate}T12:00:00`) : null
          return (
            <li key={d.id}>
              <a
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.05]"
              >
                <span className="flex w-11 shrink-0 flex-col items-center leading-none">
                  <span className="text-[11px] font-semibold text-white/55 uppercase">
                    {day ? format.dateTime(day, { month: "short" }) : "—"}
                  </span>
                  <span className="font-title text-[20px]">
                    {day ? format.dateTime(day, { day: "numeric" }) : ""}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-semibold">{d.city ?? d.venue}</span>
                  <span className="truncate text-[12px] text-white/55">
                    {[d.venue, d.localTime?.slice(0, 5)].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 rounded-pill bg-white px-3 py-1.5 text-[12px] font-semibold text-black">
                  {t("tickets")}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** A book on Goodreads and Open Library. */
export function BookLinks({ book }: { book: NonNullable<EntityDetails["book"]> }) {
  return (
    <Row>
      {book.goodreads ? <Pill href={book.goodreads} brand={siGoodreads} label="Goodreads" /> : null}
      <Pill href={book.openLibrary} icon={<BookOpen className="size-4" />} label="Open Library" />
    </Row>
  )
}
