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
