/** A time zone we can trust (a bad or missing one falls back to UTC). */
export function safeTz(tz: string | null | undefined) {
  try {
    if (tz) new Intl.DateTimeFormat("en", { timeZone: tz })
    return tz ?? "UTC"
  } catch {
    return "UTC"
  }
}

/** The hour (0–23) it is now in that time zone. */
export function hourIn(tz: string | null | undefined, now = new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTz(tz),
    hour: "2-digit",
    hour12: false,
  }).format(now)
  return Number(h) % 24
}

/** Today's date in that time zone ("2026-10-23"), to do something once a local day. */
export function dayIn(tz: string | null | undefined, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(tz) }).format(now)
}
