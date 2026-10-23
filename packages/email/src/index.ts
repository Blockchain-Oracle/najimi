import { createHmac, timingSafeEqual } from "node:crypto"
import { APP, EMAIL } from "@najimi/config"
import { env } from "@najimi/env/server"
import { Resend } from "resend"

/*
 * Email through Resend, in Najimi's own look: dark, one card, one button, Qloo credited where the
 * taste comes from. Tables and inline styles (mail clients), system fonts, hosted 2× PNGs (no SVG
 * in mail). Sign-in codes and booking news always go; the weekly digest and other news follow the
 * person's choices, and those carry a one-click unsubscribe. Without RESEND_API_KEY nothing is sent.
 */

let client: Resend | undefined
function resend(): Resend {
  if (!env.RESEND_API_KEY) throw new Error("Email isn't set up on this server")
  client ??= new Resend(env.RESEND_API_KEY)
  return client
}

export const emailReady = () => Boolean(env.RESEND_API_KEY)

const site = () => env.BETTER_AUTH_URL.replace(/\/$/, "")

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  )
const e = escapeHtml

// The palette, in the app's dark tokens (mail clients don't read CSS variables).
const INK = "#f5f3ff"
const SOFT = "#d9d6e4"
const MUTED = "#9a97a8"
const FAINT = "#6f6c7c"
const PAGE = "#07060c"
const CARD = "#121117"
const LINE = "#23222a"

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

/** A pill button: the first on a card is light (the one thing to do), the rest are quiet. */
export const button = (href: string, label: string, primary = true) =>
  `<a href="${e(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:13px 22px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;${primary ? `background:${INK};color:#0b0b0d` : `background:#1d1c22;color:${INK}`}">${e(label)}</a>`

/** A small rounded picture (artwork, a venue) with its name under it, for rows of three. */
const tile = (t: { name: string; image: string | null; note?: string | null }) =>
  `<td width="33%" valign="top" style="padding:0 6px 0 0">${
    t.image
      ? `<img src="${e(t.image)}" width="132" height="120" alt="" style="display:block;width:100%;max-width:132px;height:120px;border-radius:14px;object-fit:cover;background:${LINE}">`
      : `<div style="width:100%;max-width:132px;height:120px;border-radius:14px;background:${LINE}"></div>`
  }<p style="margin:8px 0 0;font-size:13px;font-weight:600;line-height:1.3;color:${INK}">${e(t.name)}</p>${
    t.note
      ? `<p style="margin:2px 0 0;font-size:12px;line-height:1.3;color:${MUTED}">${e(t.note)}</p>`
      : ""
  }</td>`

const row = (tiles: Parameters<typeof tile>[0][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>${tiles
    .slice(0, 3)
    .map(tile)
    .join("")}${'<td width="33%"></td>'.repeat(Math.max(0, 3 - tiles.length))}</tr></table>`

const heading = (text: string) =>
  `<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED}">${e(text)}</p>`

/** Taste words as quiet chips. */
const chips = (words: string[]) =>
  `<p style="margin:0 0 20px">${words
    .map(
      (w) =>
        `<span style="display:inline-block;margin:0 6px 6px 0;padding:6px 12px;border-radius:999px;background:#1d1c22;font-size:13px;color:${SOFT}">${e(w)}</span>`,
    )
    .join("")}</p>`

/**
 * The frame every email shares: the wordmark, one card, then why they got it, a way to manage
 * it, and Qloo's credit when the email is about their taste.
 */
function layout(m: {
  preheader: string
  card: string
  why: string
  unsubscribe?: string | null
  qloo?: boolean
}) {
  const s = site()
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${APP.name}</title></head>
<body style="margin:0;padding:0;background:${PAGE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${e(m.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td style="padding:0 4px 20px"><a href="${s}" style="text-decoration:none"><img src="${s}/email/najimi@2x.png" width="93" height="37" alt="najimi" style="display:block;border:0"></a></td></tr>
<tr><td style="background:${CARD};border-radius:24px;padding:24px;border:1px solid ${LINE}">${m.card}</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;line-height:1.6;color:${FAINT}">
${m.qloo ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px"><tr><td style="font-size:12px;color:${MUTED};padding-right:6px">Taste by</td><td><img src="${s}/email/qloo@2x.png" width="41" height="14" alt="Qloo" style="display:block;border:0"></td></tr></table>` : ""}
${e(m.why)} <a href="${s}/settings" style="color:${MUTED}">Manage email</a>${m.unsubscribe ? ` · <a href="${e(m.unsubscribe)}" style="color:${MUTED}">Unsubscribe</a>` : ""}
</td></tr>
</table></td></tr></table></body></html>`
}

/** A sign-in code, big and plain. */
export function codeEmail(code: string) {
  const minutes = Math.round(EMAIL.codeExpiresInSeconds / 60)
  return {
    subject: `${code} is your ${APP.name} code`,
    text: `Your ${APP.name} code is ${code}. It works for ${minutes} minutes.\n\nIf you didn't ask for it, ignore this email: nobody can sign in without the code.`,
    html: layout({
      preheader: `Your code works for ${minutes} minutes.`,
      card: `<p style="margin:0 0 10px;font-size:15px;color:${SOFT}">Your sign-in code</p>
<p style="margin:0 0 16px;font-size:40px;font-weight:800;letter-spacing:8px;font-family:SFMono-Regular,Menlo,monospace;color:${INK}">${e(code)}</p>
<p style="margin:0;font-size:14px;line-height:1.55;color:${MUTED}">It works for ${minutes} minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.</p>`,
      why: `You asked to sign in to ${APP.name}.`,
    }),
  }
}

/**
 * A booking's news (the outcome of a table call, a confirmed or failed stay, a reminder): the
 * venue's picture, what happened, one button back into the chat, and the call's recording.
 */
export function bookingEmail(b: {
  headline: string
  text: string
  venue: string
  when: string | null
  image: string | null
  open: string
  recording: string | null
  unsubscribe: string
}) {
  return {
    subject: b.headline,
    headers: {
      "List-Unsubscribe": `<${b.unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    text: [
      b.text,
      b.when ? `When: ${b.when}` : null,
      `Open it in ${APP.name}: ${b.open}`,
      b.recording ? `Listen to the call: ${b.recording}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: layout({
      preheader: b.text,
      card: `${b.image ? `<img src="${e(b.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:16px;object-fit:cover;margin:0 0 16px">` : ""}
<p style="margin:0 0 4px;font-size:20px;font-weight:700;line-height:1.3">${e(b.venue)}</p>
${b.when ? `<p style="margin:0 0 16px;font-size:14px;color:${MUTED}">${e(b.when)}</p>` : ""}
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${SOFT}">${e(b.text)}</p>
${button(b.open, `Open in ${APP.name}`)}${b.recording ? button(b.recording, "Listen to the call", false) : ""}`,
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
    html: layout({
      preheader: `Your taste, read by Qloo: ${w.words.slice(0, 3).join(", ")}`,
      card: `<p style="margin:0 0 6px;font-size:24px;font-weight:800;line-height:1.2">Hi ${e(w.name)}, here's your taste.</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${SOFT}">Najimi read what you love through Qloo. Your feed, your matches and every plan Najimi makes start here.</p>
${w.words.length ? `${heading("Your taste is")}${chips(w.words.slice(0, 6))}` : ""}
${w.picks.length ? `${heading("Three things for you")}${row(w.picks.map((p) => ({ name: p.name, image: p.image, note: p.because ? `because ${p.because}` : null })))}` : ""}
${button(w.open, "Open your feed")}`,
      why: `You're getting this because you joined ${APP.name}.`,
      qloo: true,
    }),
  }
}

/** The week in taste, Sunday evening their time: what they loved, one new thing, what's next. */
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
    html: layout({
      preheader: d.pick ? `New for you: ${d.pick.name}` : "Your week on Najimi",
      card: `<p style="margin:0 0 18px;font-size:24px;font-weight:800;line-height:1.2">Your week in taste</p>
${d.pick ? `${heading("New for you")}${d.pick.image ? `<img src="${e(d.pick.image)}" width="432" alt="" style="display:block;width:100%;max-width:432px;height:auto;max-height:240px;border-radius:18px;object-fit:cover;margin:0 0 12px;background:${LINE}">` : ""}<p style="margin:0 0 4px;font-size:18px;font-weight:700">${e(d.pick.name)}</p>${d.pick.because ? `<p style="margin:0 0 20px;font-size:14px;color:${MUTED}">Because you love ${e(d.pick.because)}</p>` : `<p style="margin:0 0 20px"></p>`}` : ""}
${d.loved.length ? `${heading("You loved this week")}${row(d.loved.map((l) => ({ name: l.name, image: l.image })))}` : ""}
${d.coming.length ? `${heading("Coming up")}${d.coming.map((c) => `<p style="margin:0 0 8px;font-size:15px;color:${INK}">${e(c.title)} <span style="color:${MUTED}">· ${e(c.when)}</span></p>`).join("")}<p style="margin:0 0 12px"></p>` : ""}
${d.followers.length ? `${heading("New followers")}<p style="margin:0 0 20px;font-size:15px;color:${SOFT}">${e(d.followers.join(", "))}</p>` : ""}
<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${SOFT}">${e(d.nudge.text)}</p>
${button(d.nudge.url, d.nudge.label)}${button(d.open, `Open ${APP.name}`, false)}`,
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
