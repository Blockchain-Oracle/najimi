/*
 * Local times in someone's time zone without a time-zone library: "21:00 on 2026-10-24 in
 * Africa/Lagos" as an exact instant, and today's date there.
 */

const partsIn = (instant: number, timeZone: string) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
  const p = Object.fromEntries(fmt.formatToParts(new Date(instant)).map((x) => [x.type, x.value]))
  return Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
  )
}

/** The instant a wall-clock time happens in a time zone. */
export function zonedTime(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const [hh, mm] = time.split(":").map(Number) as [number, number]
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  // How far the zone is from UTC around then, applied twice to settle across a clock change.
  let instant = wall - (partsIn(wall, timeZone) - wall)
  instant = wall - (partsIn(instant, timeZone) - instant)
  return new Date(instant)
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export const todayIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone }).format(now)

/** A time zone we can use, or UTC. */
export function safeZone(tz: string | null | undefined) {
  if (!tz) return "UTC"
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return tz
  } catch {
    return "UTC"
  }
}
