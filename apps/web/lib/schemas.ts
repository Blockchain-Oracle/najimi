import { LOOKS, type LookId, TASTE, TASTE_DOMAINS } from "@najimi/config"
import { z } from "zod"

const entityTypes = TASTE_DOMAINS.map((d) => d.type) as [string, ...string[]]

/** A love as the picker sends it: a real Qloo entity, never free text. */
export const loveInput = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.enum(entityTypes),
  name: z.string().trim().min(1).max(200),
  image: z.string().url().max(1000).nullable().optional(),
  weight: z.number().int().min(TASTE.weightMin).max(TASTE.weightMax).default(TASTE.weightDefault),
})
export type LoveInput = z.infer<typeof loveInput>

export const personInput = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().max(120).nullable().optional(),
  /** Where the map pin landed (a Qloo locality's coordinates). */
  cityLat: z.number().min(-90).max(90).nullable().optional(),
  cityLon: z.number().min(-180).max(180).nullable().optional(),
  /** A face from LOOKS; it sets the identity colour. */
  look: z
    .enum(LOOKS.map((l) => l.id) as [LookId, ...LookId[]])
    .nullable()
    .optional(),
  locale: z.string().max(8).nullable().optional(),
  /** A line about themselves, on their profile. */
  bio: z.string().trim().max(160).nullable().optional(),
  /** Who sees their taste and finds them. */
  visibility: z.enum(["public", "friends", "private"]).optional(),
})

export const pickInput = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.string().max(40),
  name: z.string().max(200),
  image: z.string().max(1000).nullable().optional(),
})
