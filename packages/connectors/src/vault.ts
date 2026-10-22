import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/*
 * Sessions people connect are sealed before they touch the database: AES-256-GCM with a key made
 * from CONNECTOR_SECRET, a fresh 12-byte nonce each time, and the owner, platform and account as
 * associated data, so a sealed value copied onto another row won't open. Pure: the secret is passed
 * in (sessions.ts reads it from the environment).
 */

const VERSION = "v1"

const keyOf = (secret: string) => createHash("sha256").update(secret).digest()

export function sealWith(secret: string, plain: string, boundTo: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", keyOf(secret), iv)
  cipher.setAAD(Buffer.from(boundTo))
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  return [VERSION, ...[iv, cipher.getAuthTag(), body].map((p) => p.toString("base64url"))].join(".")
}

export function openWith(secret: string, sealed: string, boundTo: string): string {
  const [version, iv, tag, body] = sealed.split(".")
  if (version !== VERSION || !iv || !tag || !body)
    throw new Error("This connection can't be read; connect it again")
  const decipher = createDecipheriv("aes-256-gcm", keyOf(secret), Buffer.from(iv, "base64url"))
  decipher.setAAD(Buffer.from(boundTo))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

/** What a sealed session is bound to. */
export const boundOf = (row: { userId: string; platform: string; accountId: string }) =>
  `${row.userId}:${row.platform}:${row.accountId}`
