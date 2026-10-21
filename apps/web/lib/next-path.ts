/**
 * Where to go after a detour (sign-up from a shared workflow link): only a path on this site, never
 * another origin ("//evil.example" or "/\\evil.example" would leave it).
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null
  return value
}
