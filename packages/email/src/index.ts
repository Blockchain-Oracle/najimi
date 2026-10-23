import { createHmac, timingSafeEqual } from "node:crypto"
import { APP, EMAIL } from "@najimi/config"
import { env } from "@najimi/env/server"
import { Resend } from "resend"

/*
 * Email through Resend, in Najimi's own look. Light on purpose (most mail apps draw email light,
 * and some invert a dark email into mud): a soft paper page, one white card with the aura across
 * its top and Najimi's mark and wordmark in its corner, a big Funnel Display headline, then one
 * ink button and the plain reasons it came. A booking is drawn as its ticket: the venue's picture,
 * the orb pressed on like a stamp, the facts, a perforation, and the stub with the call's
 * recording and the calendar. Tables and inline styles only; pictures are hosted PNGs (mail shows
 * no SVG). Sign-in codes always go; booking news and the weekly digest follow the person's choice
 * and carry a one-click unsubscribe.
 */

let client: Resend | undefined
function resend(): Resend {
  if (!env.RESEND_API_KEY) throw new Error("Email isn't set up on this server")
  client ??= new Resend(env.RESEND_API_KEY)
  return client
}

export const emailReady = () => Boolean(env.RESEND_API_KEY)

const site = () => env.BETTER_AUTH_URL.replace(/\/$/, "")
const asset = (name: string) => `${site()}/email/${name}`

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  )
const e = escapeHtml

// The light tokens (mail clients don't read CSS variables).
const PAPER = "#F4F4F6"
const CARD = "#FFFFFF"
const INK = "#0B0B0D"
const TEXT2 = "#45454D"
const TEXT3 = "#6B6B73"
const RULE = "#E8E8EC"
const GOOD = "#1F7A45"
const BAD = "#B3261E"
const WIDTH = 520

const SANS =
  "'Funnel Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const DISPLAY = "'Funnel Display','Helvetica Neue',Helvetica,Arial,sans-serif"
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
const TABLE = `role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`

export type EmailKind = "weekly" | "news"

/* Unsubscribe links: signed, so only the person's own link turns their email off. */
const sign = (text: string) =>
  createHmac("sha256", env.BETTER_AUTH_SECRET).update(`email:${text}`).digest("base64url")

export function unsubscribeUrl(userId: string, kind: EmailKind) {
  const body = Buffer.from(JSON.stringify({ u: userId, k: kind })).toString("base64url")
  return `${site()}/api/email/unsubscribe?t=${body}.${sign(body)}`
}

export function readUnsubscribe(token: string | null): { userId: string; kind: EmailKind } | null {
  const [body, mac] = (token ?? "").split(".")
  if (!body || !mac) return null
  const want = sign(body)
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want)))
    return null
  const data = JSON.parse(Buffer.from(body, "base64url").toString()) as { u: string; k: EmailKind }
  return data.k === "weekly" || data.k === "news" ? { userId: data.u, kind: data.k } : null
}

/** The corner every card wears: Najimi's mark and wordmark, with a small word on the far side. */
const brandRow = (aside?: string) => `<table ${TABLE}><tr>
<td style="vertical-align:middle"><img src="${asset("mark.png")}" width="34" height="34" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px"><img src="${asset("wordmark@2x.png")}" width="93" height="37" alt="najimi" style="display:inline-block;vertical-align:middle;border:0;margin-left:8px"></td>
${aside ? `<td style="vertical-align:middle;text-align:right;font:700 11px/1.3 ${SANS};color:${TEXT3};letter-spacing:1.4px;text-transform:uppercase">${e(aside)}</td>` : ""}
</tr></table>`

const auraBar = `<tr><td style="padding:0;line-height:0;font-size:0"><img src="${asset("aura-bar.png")}" width="${WIDTH}" height="6" alt="" style="display:block;width:100%;height:6px;border:0"></td></tr>`

const eyebrow = (text: string, color = TEXT3) =>
  `<div style="font:700 12px/1.4 ${SANS};color:${color};letter-spacing:1.3px;text-transform:uppercase;margin:0 0 8px">${e(text)}</div>`

const headline = (text: string, size = 34) =>
  `<div style="font:800 ${size}px/1.08 ${DISPLAY};color:${INK};letter-spacing:-0.5px;margin:0">${e(text)}</div>`

const paragraph = (text: string, top = 14) =>
  `<div style="font:16px/1.6 ${SANS};color:${TEXT2};margin:${top}px 0 0">${e(text)}</div>`

/** Taste words as soft chips. */
const chips = (words: string[]) =>
  `<div style="margin:12px 0 0">${words
    .map(
      (w) =>
        `<span style="display:inline-block;margin:0 6px 8px 0;padding:7px 13px;border-radius:999px;background:${PAPER};font:600 13px/1 ${SANS};color:${INK}">${e(w)}</span>`,
    )
    .join("")}</div>`

/** Three things in a row: artwork, name, and a line under it. */
const tiles = (items: { name: string; image: string | null; note?: string | null }[]) =>
  `<table ${TABLE} style="margin:12px 0 0"><tr>${items
    .slice(0, 3)
    .map(
      (t) =>
        `<td width="33%" valign="top" style="padding:0 8px 0 0">${
          t.image
            ? `<img src="${e(t.image)}" width="140" height="130" alt="" style="display:block;width:100%;max-width:140px;height:130px;object-fit:cover;border-radius:14px;background:${PAPER};border:0">`
            : `<div style="width:100%;max-width:140px;height:130px;border-radius:14px;background:${PAPER}"></div>`
        }<div style="font:700 14px/1.3 ${SANS};color:${INK};margin:10px 0 0">${e(t.name)}</div>${
          t.note
            ? `<div style="font:13px/1.35 ${SANS};color:${TEXT3};margin:2px 0 0">${e(t.note)}</div>`
            : ""
        }</td>`,
    )
    .join("")}${'<td width="33%"></td>'.repeat(Math.max(0, 3 - items.length))}</tr></table>`

const section = (title: string, inner: string) =>
  `<div style="margin:26px 0 0">${eyebrow(title)}${inner}</div>`

/** The perforation between a ticket and its stub: a dashed rule with a notch cut out of each side. */
function perforation() {
  const notch = (side: "left" | "right") =>
    `<td width="10" style="width:10px;padding:0"><div style="width:10px;height:20px;background:${PAPER};border-radius:${side === "left" ? "0 20px 20px 0" : "20px 0 0 20px"}"></div></td>`
  return `<tr><td style="padding:0"><table ${TABLE}><tr>${notch("left")}<td style="padding:0 12px"><div style="border-top:1px dashed #CFCFD6;height:1px;line-height:1px;font-size:1px">&nbsp;</div></td>${notch("right")}</tr></table></td></tr>`
}

type Link = { label: string; href: string }

/** The page around a card: the card, then the ink button, quiet links, and why it came. */
function page(m: {
  preheader: string
  card: string
  primary?: Link
  secondary?: Link[]
  why: string
  unsubscribe?: string | null
  qloo?: boolean
}) {
  const s = site()
  const links = (m.secondary ?? [])
    .map(
      (l) =>
        `<a href="${e(l.href)}" style="color:${INK};text-decoration:underline;margin-right:16px">${e(l.label)}</a>`,
    )
    .join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${APP.name}</title>
<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@700;800&family=Funnel+Sans:wght@400;600;700&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${e(m.preheader)}</div>
<table ${TABLE} style="background:${PAPER}"><tr><td align="center" style="padding:32px 14px">
${m.card}
<table ${TABLE} style="max-width:${WIDTH}px"><tr><td style="padding:22px 4px 0">
${m.primary ? `<a href="${e(m.primary.href)}" style="display:inline-block;background:${INK};color:#FFFFFF;font:700 15px/1 ${SANS};padding:16px 26px;border-radius:999px;text-decoration:none">${e(m.primary.label)}</a>` : ""}
${links ? `<div style="margin:16px 0 0;font:14px/1.6 ${SANS}">${links}</div>` : ""}
${m.qloo ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0"><tr><td style="font:600 12px/1 ${SANS};color:${TEXT3};padding-right:7px;vertical-align:middle">Taste by</td><td style="vertical-align:middle"><img src="${asset("qloo-ink@2x.png")}" width="41" height="14" alt="Qloo" style="display:block;border:0"></td></tr></table>` : ""}
<div style="margin:${m.qloo ? "12px" : "26px"} 0 0;font:12px/1.65 ${SANS};color:${TEXT3}">${e(m.why)}<br><a href="${s}/settings" style="color:${TEXT3};text-decoration:underline">Manage email</a>${m.unsubscribe ? ` · <a href="${e(m.unsubscribe)}" style="color:${TEXT3};text-decoration:underline">Unsubscribe</a>` : ""}</div>
<div style="margin:14px 0 0;font:12px/1.6 ${SANS};color:${TEXT3}">${APP.name} · <a href="${s}" style="color:${TEXT3};text-decoration:none">najimi.xyz</a></div>
</td></tr></table>
</td></tr></table></body></html>`
}

/** A plain white card: the aura bar, the corner, then whatever the email says. */
const card = (aside: string | undefined, inner: string) =>
  `<table ${TABLE} style="max-width:${WIDTH}px;background:${CARD};border:1px solid ${RULE};border-radius:24px;overflow:hidden">
${auraBar}
<tr><td style="padding:24px 28px 0">${brandRow(aside)}</td></tr>
<tr><td style="padding:22px 28px 30px">${inner}</td></tr>
</table>`

/** A sign-in code, big, in its own box. */
export function codeEmail(code: string) {
  const minutes = Math.round(EMAIL.codeExpiresInSeconds / 60)
  return {
    subject: `${code} is your ${APP.name} code`,
    text: `Your ${APP.name} code is ${code}. It works for ${minutes} minutes.\n\nIf you didn't ask for it, ignore this email: nobody can sign in without the code.`,
    html: page({
      preheader: `It works for ${minutes} minutes.`,
      card: card(
        "Sign in",
        `${eyebrow("Your sign-in code")}${headline("Here's your code.")}
<div style="margin:22px 0 0;padding:22px;background:${PAPER};border-radius:18px;text-align:center;font:700 38px/1 ${MONO};letter-spacing:12px;color:${INK}">${e(code)}</div>
${paragraph(`It works for ${minutes} minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.`)}`,
      ),
      why: `You asked to sign in to ${APP.name}.`,
    }),
  }
}

export type BookingFact = { label: string; value: string }

/**
 * A booking's news as its ticket: the venue's picture across the top, what happened in a word
 * (booked, not booked, a reminder) with the orb stamped beside a confirmed one, the facts, then a
 * perforation and the stub: the call's recording and the calendar.
 */
export function bookingEmail(b: {
  /** "Table booked", "Not booked", "Reminder". */
  label: string
  /** The ticket's number, in its corner ("No. 22491C"). */
  folio: string
  tone: "good" | "bad" | "plain"
  headline: string
  text: string
  venue: string
  when: string | null
  image: string | null
  facts: BookingFact[]
  open: string
  recording: string | null
  calendar: string | null
  unsubscribe: string
}) {
  const color = b.tone === "good" ? GOOD : b.tone === "bad" ? BAD : TEXT3
  const facts = b.facts
    .map(
      (f) => `<tr>
<td style="padding:7px 0;font:14px/20px ${SANS};color:${TEXT3};vertical-align:top">${e(f.label)}</td>
<td style="padding:7px 0;font:700 14px/20px ${SANS};color:${INK};text-align:right;vertical-align:top">${e(f.value)}</td></tr>`,
    )
    .join("")
  const pill = (href: string, label: string) =>
    `<a href="${e(href)}" style="display:inline-block;margin:0 10px 8px 0;padding:11px 16px;border-radius:999px;background:${PAPER};color:${INK};font:700 14px/1 ${SANS};text-decoration:none">${label}</a>`
  const stub = [
    b.recording ? pill(b.recording, "&#9654;&nbsp; Hear the call") : "",
    b.calendar ? pill(b.calendar, "Add to Google Calendar") : "",
  ].join("")
  const ticket = `<table ${TABLE} style="max-width:${WIDTH}px;background:${CARD};border:1px solid ${RULE};border-radius:24px;overflow:hidden">
${b.image ? `<tr><td style="padding:0;line-height:0"><img src="${e(b.image)}" width="${WIDTH}" height="200" alt="" style="display:block;width:100%;height:200px;object-fit:cover;border:0;background:${PAPER}"></td></tr>` : auraBar}
<tr><td style="padding:22px 26px 0">${brandRow(b.folio)}</td></tr>
<tr><td style="padding:20px 26px 0"><table ${TABLE}><tr>
<td style="vertical-align:top">${eyebrow(b.label, color)}${headline(b.venue, 30)}${b.when ? `<div style="font:600 16px/1.45 ${SANS};color:${TEXT2};margin:8px 0 0">${e(b.when)}</div>` : ""}</td>
${b.tone === "good" ? `<td width="88" style="width:88px;vertical-align:top;text-align:right"><img src="${asset("orb@2x.png")}" width="80" height="80" alt="" style="display:inline-block;border:0"></td>` : ""}
</tr></table></td></tr>
<tr><td style="padding:16px 26px 0">${paragraph(b.text, 0)}</td></tr>
${facts ? `<tr><td style="padding:14px 26px 18px"><div style="border-top:1px solid ${RULE};padding-top:8px"><table ${TABLE}>${facts}</table></div></td></tr>` : `<tr><td style="padding:0 0 18px"></td></tr>`}
${stub ? `${perforation()}<tr><td style="padding:18px 26px 16px">${stub}</td></tr>` : ""}
</table>`
  return {
    subject: b.headline,
    headers: {
      "List-Unsubscribe": `<${b.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: [
      b.text,
      b.when ? `When: ${b.when}` : null,
      ...b.facts.map((f) => `${f.label}: ${f.value}`),
      `Open it in ${APP.name}: ${b.open}`,
      b.recording ? `Hear the call: ${b.recording}` : null,
      b.calendar ? `Add to Google Calendar: ${b.calendar}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: page({
      preheader: b.text,
      card: ticket,
      primary: { label: `Open in ${APP.name}`, href: b.open },
      why: `You're getting this because you booked through ${APP.name}.`,
      unsubscribe: b.unsubscribe,
    }),
  }
}

export type EmailPick = { name: string; image: string | null; because: string | null }

/** Once their taste is read: the words it's made of and three things it found for them. */
export function welcomeEmail(w: {
  name: string
  words: string[]
  picks: EmailPick[]
  open: string
}) {
  return {
    subject: `${w.name}, here's your taste`,
    text: [
      `Hi ${w.name}, Najimi has read your taste through Qloo.`,
      w.words.length ? `It's ${w.words.join(", ")}.` : null,
      w.picks.length ? `Three things for you: ${w.picks.map((p) => p.name).join(", ")}.` : null,
      `Open your feed: ${w.open}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: page({
      preheader: `Your taste, read by Qloo: ${w.words.slice(0, 3).join(", ")}`,
      card: card(
        "Welcome",
        `${eyebrow(`Hi ${w.name}`)}${headline("Here's your taste.")}
${paragraph("Najimi read what you love through Qloo. Your feed, your people and every plan Najimi makes for you start here.")}
${w.words.length ? section("Your taste is", chips(w.words.slice(0, 6))) : ""}
${w.picks.length ? section("Three things for you", tiles(w.picks.map((p) => ({ name: p.name, image: p.image, note: p.because ? `because ${p.because}` : null })))) : ""}`,
      ),
      primary: { label: "Open your feed", href: w.open },
      why: `You're getting this because you joined ${APP.name}.`,
      qloo: true,
    }),
  }
}

/** The week in taste, Sunday evening their time: what's new for them, what they loved, what's next. */
export function digestEmail(d: {
  name: string
  loved: { name: string; image: string | null }[]
  pick: EmailPick | null
  coming: { title: string; when: string }[]
  followers: string[]
  nudge: { text: string; label: string; url: string }
  open: string
  unsubscribe: string
}) {
  const lines = [
    d.loved.length ? `You loved: ${d.loved.map((l) => l.name).join(", ")}.` : null,
    d.pick
      ? `New for you: ${d.pick.name}${d.pick.because ? `, because ${d.pick.because}` : ""}.`
      : null,
    d.coming.length
      ? `Coming up: ${d.coming.map((c) => `${c.title} (${c.when})`).join("; ")}.`
      : null,
    d.followers.length ? `New followers: ${d.followers.join(", ")}.` : null,
    `${d.nudge.text} ${d.nudge.url}`,
  ]
  const pick = d.pick
    ? section(
        "New for you",
        `${d.pick.image ? `<img src="${e(d.pick.image)}" width="464" height="240" alt="" style="display:block;width:100%;max-width:464px;height:240px;object-fit:cover;border-radius:18px;background:${PAPER};border:0;margin:4px 0 12px">` : ""}<div style="font:800 22px/1.2 ${DISPLAY};color:${INK}">${e(d.pick.name)}</div>${d.pick.because ? `<div style="font:15px/1.5 ${SANS};color:${TEXT3};margin:4px 0 0">Because you love ${e(d.pick.because)}</div>` : ""}`,
      )
    : ""
  const coming = d.coming.length
    ? section(
        "Coming up",
        d.coming
          .map(
            (c) =>
              `<table ${TABLE} style="margin:0 0 8px"><tr><td style="padding:12px 14px;background:${PAPER};border-radius:14px;font:700 15px/1.4 ${SANS};color:${INK}">${e(c.title)}<div style="font:600 13px/1.4 ${SANS};color:${TEXT3};margin:2px 0 0">${e(c.when)}</div></td></tr></table>`,
          )
          .join(""),
      )
    : ""
  return {
    subject: d.pick ? `Your week in taste: ${d.pick.name} and more` : "Your week in taste",
    text: [
      `Hi ${d.name}, your week on ${APP.name}.`,
      ...lines.filter(Boolean),
      `Unsubscribe: ${d.unsubscribe}`,
    ].join("\n\n"),
    headers: {
      "List-Unsubscribe": `<${d.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    html: page({
      preheader: d.pick ? `New for you: ${d.pick.name}` : "Your week on Najimi",
      card: card(
        "This week",
        `${eyebrow(`Hi ${d.name}`)}${headline("Your week in taste.")}
${pick}
${d.loved.length ? section("You loved this week", tiles(d.loved.map((l) => ({ name: l.name, image: l.image })))) : ""}
${coming}
${d.followers.length ? section("New followers", `<div style="font:600 15px/1.5 ${SANS};color:${INK}">${e(d.followers.join(", "))}</div>`) : ""}
${section("This week, try", `<div style="font:16px/1.55 ${SANS};color:${TEXT2}">${e(d.nudge.text)}</div>`)}`,
      ),
      primary: { label: d.nudge.label, href: d.nudge.url },
      secondary: [{ label: `Open ${APP.name}`, href: d.open }],
      why: `Your weekly digest from ${APP.name}, every Sunday evening.`,
      unsubscribe: d.unsubscribe,
      qloo: true,
    }),
  }
}

export async function sendEmail(mail: {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
  /** The same key never sends twice (Resend keeps it for a day). */
  idempotencyKey?: string
}) {
  const { data, error } = await resend().emails.send(
    {
      from: env.EMAIL_FROM ?? EMAIL.from,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      headers: mail.headers,
    },
    mail.idempotencyKey ? { idempotencyKey: mail.idempotencyKey } : undefined,
  )
  if (error) throw new Error(error.message)
  return { id: data?.id ?? "" }
}

/** A report for the owner to review: who, why, what they said (plain; it's an inbox for one). */
export function reportEmail(r: {
  reason: string
  note: string | null
  target: string | null
  message: string | null
}) {
  const lines = [
    `Reason: ${r.reason}`,
    r.target ? `About: ${r.target}` : null,
    r.message ? `Message: "${r.message}"` : null,
    r.note ? `Note: ${r.note}` : null,
  ].filter((l): l is string => Boolean(l))
  return {
    subject: `Report on ${APP.name}: ${r.reason}`,
    text: lines.join("\n"),
    html: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5">${lines.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join("")}</body></html>`,
  }
}
