import { TASTE, TASTE_DOMAINS } from "@najimi/config"
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

export const constraintsInput = z.object({
  diet: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  iddsi: z.number().int().min(0).max(7).nullable().optional(),
  serveWarm: z.boolean().optional(),
  medications: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  budget: z.string().trim().max(80).optional(),
  notes: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
})

export const AGE_BANDS = [
  "24_and_younger",
  "25_to_29",
  "30_to_34",
  "35_to_44",
  "45_to_54",
  "55_and_older",
] as const

export const personInput = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().max(120).nullable().optional(),
  locale: z.string().max(8).nullable().optional(),
  ageBand: z.enum(AGE_BANDS).nullable().optional(),
  constraints: constraintsInput.optional(),
})

export const pickInput = z.object({
  qlooId: z.string().min(8).max(64),
  type: z.string().max(40),
  name: z.string().max(200),
  image: z.string().max(1000).nullable().optional(),
})
