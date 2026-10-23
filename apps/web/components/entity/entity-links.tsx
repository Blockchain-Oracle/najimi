"use client"

import { cn } from "@najimi/ui/lib/utils"
import {
  BookOpen,
  Car,
  Clock,
  Globe,
  type LucideIcon,
  MapPin,
  Navigation,
  Phone,
  Play,
  Star,
} from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import type { ReactNode } from "react"
import {
  type SimpleIcon,
  siApplemusic,
  siApplepodcasts,
  siFacebook,
  siGoodreads,
  siGoogle,
  siGooglemaps,
  siImdb,
  siInstagram,
  siLetterboxd,
  siSpotify,
  siTicketmaster,
  siTiktok,
  siX,
  siYoutube,
  siYoutubemusic,
} from "simple-icons"
import { BrandIcon } from "@/components/brands/brand-icon"
import {
  type EntityDetails,
  type EntityVideo,
  type OutLink,
  openingToday,
  type Site,
} from "@/lib/entity"
import { uberLink } from "@/lib/rides"

/*
 * Where a thing leads, in the same sections for every kind, under the entity sheet's stage: how to
 * have it (a place's Directions-first pill row; where to watch, listen or read), more videos that
 * play in the stage, an artist's next concerts, what people say (TikTok,
 * YouTube, Instagram, X and the review site of its kind), and the accounts to follow. Every link
 * carries the site's own mark.
 */

/** Each site's mark and name (brand names stay as they are in every language). */
export const SITES: Record<Site, { brand?: SimpleIcon; icon?: LucideIcon; label?: string }> = {
  apple_music: { brand: siApplemusic, label: "Apple Music" },
  spotify: { brand: siSpotify, label: "Spotify" },
  youtube_music: { brand: siYoutubemusic, label: "YouTube Music" },
  apple_podcasts: { brand: siApplepodcasts, label: "Apple Podcasts" },
  open_library: { icon: BookOpen, label: "Open Library" },
  google_books: { brand: siGoogle, label: "Google Books" },
  tiktok: { brand: siTiktok, label: "TikTok" },
  youtube: { brand: siYoutube, label: "YouTube" },
  instagram: { brand: siInstagram, label: "Instagram" },
  x: { brand: siX, label: "X" },
  facebook: { brand: siFacebook, label: "Facebook" },
  letterboxd: { brand: siLetterboxd, label: "Letterboxd" },
  imdb: { brand: siImdb, label: "IMDb" },
  goodreads: { brand: siGoodreads, label: "Goodreads" },
  google: { brand: siGooglemaps },
  website: { icon: Globe },
}

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

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[12px] font-semibold tracking-[0.1em] text-white/50 uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** A row of links, each with its site's mark: where to listen, what people say, who to follow. */
export function LinkRow({ title, links }: { title: string; links: OutLink[] }) {
  const t = useTranslations("Entity")
  if (!links.length) return null
  return (
    <Section title={title}>
      <Row>
        {links.map((l) => {
          const s = SITES[l.site]
          const Icon = s.icon
          const label = s.label ?? (l.site === "google" ? t("googleReviews") : t("website"))
          return (
            <Pill
              key={`${l.site}-${l.url}`}
              href={l.url}
              brand={s.brand}
              icon={Icon ? <Icon className="size-4" /> : undefined}
              label={label}
            />
          )
        })}
      </Row>
    </Section>
  )
}

/** A place: Directions first and filled, then Uber, Call, its site and Maps; today's hours. */
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
        <Pill href={place.maps} brand={siGooglemaps} label={t("maps")} />
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

/** Where a film or show streams, rents or sells in your country (JustWatch's data, credited). */
export function WhereToWatch({ film }: { film: NonNullable<EntityDetails["film"]> }) {
  const t = useTranslations("Entity")
  if (!film.providers.length) return null
  return (
    <Section title={t("whereToWatch")}>
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
    </Section>
  )
}

/** More videos (a film's clips, an artist's music videos); a tap plays it in the stage. */
export function VideoRow({
  videos,
  playing,
  onPlay,
}: {
  videos: EntityVideo[]
  playing: string | null
  onPlay: (video: EntityVideo) => void
}) {
  const t = useTranslations("Entity")
  if (!videos.length) return null
  return (
    <Section title={t("moreVideos")}>
      <Row>
        {videos.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onPlay(v)}
            aria-pressed={playing === v.id}
            className="group flex w-44 shrink-0 flex-col gap-1.5 text-start"
          >
            <span
              className={cn(
                "relative block aspect-video overflow-hidden rounded-tile bg-black",
                playing === v.id && "ring-2 ring-[var(--color-aura-1)]",
              )}
            >
              {v.poster ? (
                // biome-ignore lint/performance/noImgElement: the video's own still
                <img
                  src={v.poster}
                  alt=""
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : null}
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-9 place-items-center rounded-full bg-black/50 ring-1 ring-white/30 backdrop-blur">
                  <Play className="ms-0.5 size-4 fill-white text-white" />
                </span>
              </span>
            </span>
            <span className="line-clamp-2 text-[12px] leading-snug text-white/75">{v.title}</span>
          </button>
        ))}
      </Row>
    </Section>
  )
}

/** An artist's next concerts, each straight to its tickets (Ticketmaster). */
export function TourLinks({ tour }: { tour: EntityDetails["tour"] }) {
  const t = useTranslations("Entity")
  const format = useFormatter()
  if (!tour.length) return null
  return (
    <Section title={t("onTour")}>
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
                <span className="flex shrink-0 items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-[12px] font-semibold text-black">
                  <BrandIcon icon={siTicketmaster} className="size-3.5" />
                  {t("tickets")}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
