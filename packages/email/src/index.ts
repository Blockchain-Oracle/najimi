import { APP, EMAIL } from "@najimi/config"
import { env } from "@najimi/env/server"
import { Resend } from "resend"

/*
 * Email through Resend: only sign-in codes. Without RESEND_API_KEY the server says email isn't set
 * up, and the sign-in sheet hides the email option.
 */

let client: Resend | undefined
function resend(): Resend {
  if (!env.RESEND_API_KEY) throw new Error("Email isn't set up on this server")
  client ??= new Resend(env.RESEND_API_KEY)
  return client
}

export const emailReady = () => Boolean(env.RESEND_API_KEY)

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  )

/** A sign-in code, big and plain, on cream paper (tables and inline styles: mail clients). */
export function codeEmail(code: string) {
  const minutes = Math.round(EMAIL.codeExpiresInSeconds / 60)
  const safe = escapeHtml(code)
  return {
    subject: `${code} is your ${APP.name} code`,
    text: `Your ${APP.name} code is ${code}. It works for ${minutes} minutes.\n\nIf you didn't ask for it, ignore this email: nobody can sign in without the code.`,
    html: `<!doctype html><html><body style="margin:0;background:#211922;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px"><tr><td style="padding:0 4px 16px;color:#fff6ee;font-size:22px;font-weight:800">najimi</td></tr>
<tr><td style="background:#fffaf7;border-radius:20px;padding:28px;color:#111114">
<p style="margin:0 0 10px;font-size:15px">Your sign-in code</p>
<p style="margin:0 0 16px;font-size:40px;font-weight:800;letter-spacing:6px;font-family:SFMono-Regular,Menlo,monospace">${safe}</p>
<p style="margin:0;font-size:14px;color:#5f5055">It works for ${minutes} minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.</p>
</td></tr></table></td></tr></table></body></html>`,
  }
}

export async function sendEmail(mail: { to: string; subject: string; html: string; text: string }) {
  const { data, error } = await resend().emails.send({
    from: env.EMAIL_FROM ?? EMAIL.from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  })
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

/**
 * A booking's news by email (the outcome of a call, a confirmed stay, a reminder): Najimi's dark
 * look in tables and inline styles, the venue's picture, one button back into the chat, and the
 * call's recording when there is one.
 */
export function bookingEmail(b: {
  headline: string
  text: string
  venue: string
  when: string | null
  image: string | null
  open: string
  recording: string | null
}) {
  const e = escapeHtml
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${e(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:999px;font-size:15px;font-weight:700;text-decoration:none;${primary ? "background:#f5f3ff;color:#0b0b0d" : "background:#1d1c22;color:#f5f3ff"}">${e(label)}</a>`
  return {
    subject: b.headline,
    text: [
      b.text,
      b.when ? `When: ${b.when}` : null,
      `Open it in ${APP.name}: ${b.open}`,
      b.recording ? `Listen to the call: ${b.recording}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    html: `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head><body style="margin:0;background:#07060c;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#f5f3ff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07060c"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px">
<tr><td style="padding:0 4px 20px;font-size:22px;font-weight:800;letter-spacing:-0.5px">najimi</td></tr>
<tr><td style="background:#121117;border-radius:24px;padding:24px;border:1px solid #23222a">
${b.image ? `<img src="${e(b.image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:16px;object-fit:cover;margin:0 0 16px">` : ""}
<p style="margin:0 0 4px;font-size:20px;font-weight:700;line-height:1.3">${e(b.venue)}</p>
${b.when ? `<p style="margin:0 0 16px;font-size:14px;color:#9a97a8">${e(b.when)}</p>` : ""}
<p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#d9d6e4">${e(b.text)}</p>
${button(b.open, `Open in ${APP.name}`, true)}${b.recording ? button(b.recording, "Listen to the call", false) : ""}
</td></tr>
<tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#6f6c7c">You're getting this because you booked through ${APP.name}. Manage your bookings in the app.</td></tr>
</table></td></tr></table></body></html>`,
  }
}
