import type { Brand } from "@/components/logo-cloud"

/**
 * The outside services Najimi really calls (facts from the code: packages/env, packages/sources,
 * packages/booking, packages/connectors). Marks are Simple Icons (CC0) in public/logos; a service
 * without one there shows its name alone.
 */
export const BRANDS: Brand[] = [
  { name: "OpenAI", logo: "openai" },
  { name: "Apple Music", logo: "applemusic" },
  { name: "Spotify", logo: "spotify" },
  { name: "TMDB", logo: "themoviedatabase" },
  { name: "YouTube", logo: "youtube" },
  { name: "Ticketmaster", logo: "ticketmaster" },
  { name: "Mapbox", logo: "mapbox" },
  { name: "OpenStreetMap", logo: "openstreetmap" },
  { name: "Wikidata", logo: "wikidata" },
  { name: "Nuitee" },
  { name: "ElevenLabs", logo: "elevenlabs" },
  { name: "Twilio", logo: "twilio" },
  { name: "fal" },
  { name: "X", logo: "x" },
  { name: "Instagram", logo: "instagram" },
  { name: "TikTok", logo: "tiktok" },
  { name: "Letterboxd", logo: "letterboxd" },
  { name: "Goodreads", logo: "goodreads" },
  { name: "Last.fm", logo: "lastdotfm" },
  { name: "Uber", logo: "uber" },
  { name: "Google Calendar", logo: "googlecalendar" },
  { name: "Resend", logo: "resend" },
  { name: "PostgreSQL", logo: "postgresql" },
  { name: "Next.js", logo: "nextdotjs" },
]
