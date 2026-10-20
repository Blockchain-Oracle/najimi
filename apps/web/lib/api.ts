import "server-only"
import { NextResponse } from "next/server"
import type { z } from "zod"
import { ownedBusiness } from "@/lib/access"
import { getSession } from "@/lib/session"

export const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } })

export const fail = (error: string, status: number) => json({ error }, status)

/** The signed-in (or guest) user and their business, or the response that says why not. */
export async function withBusiness(businessId: string | undefined) {
  const session = await getSession()
  if (!session) return { error: fail("Sign in first", 401) } as const
  if (!businessId) return { error: fail("Unknown business", 404) } as const
  const business = await ownedBusiness(session.user.id, businessId)
  if (!business) return { error: fail("Unknown business", 404) } as const
  return { session, business } as const
}

export async function body<S extends z.ZodType>(request: Request, schema: S) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  return parsed.success
    ? ({ data: parsed.data as z.infer<S> } as const)
    : ({ error: fail("That doesn't look right", 400) } as const)
}
