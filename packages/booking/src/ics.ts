/*
 * A plan or a booking as a calendar file (.ics, RFC 5545), and links that add it to Google or
 * Outlook in one tap.
 */

export type CalendarEvent = {
  uid: string
  title: string
  start: Date
  end: Date
  where?: string | null
  notes?: string | null
  url?: string | null
}

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Long lines fold at 75 octets (the spec), continued with a leading space. */
function fold(line: string) {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ` ${rest.slice(74)}`
  }
  out.push(rest)
  return out.join("\r\n")
}

export function icsOf(events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Najimi//Plans//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}@najimi.xyz`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      ...(e.where ? [`LOCATION:${escapeText(e.where)}`] : []),
      ...(e.notes ? [`DESCRIPTION:${escapeText(e.notes)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ]
  return `${lines.map(fold).join("\r\n")}\r\n`
}

/** One-tap "add to calendar" links for the first event. */
export function calendarLinks(e: CalendarEvent) {
  const google = new URL("https://calendar.google.com/calendar/render")
  google.searchParams.set("action", "TEMPLATE")
  google.searchParams.set("text", e.title)
  google.searchParams.set("dates", `${stamp(e.start)}/${stamp(e.end)}`)
  if (e.where) google.searchParams.set("location", e.where)
  if (e.notes) google.searchParams.set("details", e.notes)
  const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose")
  outlook.searchParams.set("subject", e.title)
  outlook.searchParams.set("startdt", e.start.toISOString())
  outlook.searchParams.set("enddt", e.end.toISOString())
  if (e.where) outlook.searchParams.set("location", e.where)
  return { google: google.toString(), outlook: outlook.toString() }
}
