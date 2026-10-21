/*
 * Fills the message catalogs from English (T18): `pnpm --filter @najimi/web i18n:translate es pt`.
 * Only keys a catalog lacks, or whose English changed since they were translated (the English each
 * one came from is kept in scripts/translated-from.json), are translated, so it can run again
 * whenever English changes. Every
 * translation must keep the English message's shape (the same {arguments}, plural and select
 * branches that parse, an `other` branch); one that doesn't is asked for again, and if it still
 * fails it stays missing and the app shows the English string.
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { type MessageFormatElement, parse, TYPE } from "@formatjs/icu-messageformat-parser"
import { agentModel } from "@najimi/agent"
import { LOCALES } from "@najimi/config"
import { generateText, Output } from "ai"
import { z } from "zod"

type Tree = { [key: string]: string | Tree }

const DIR = join(import.meta.dirname, "../messages")
/** locale → key → the English a translation was made from. */
const SOURCES = join(import.meta.dirname, "translated-from.json")
type Sources = Record<string, Record<string, string>>
const CHUNK = 90
const ATTEMPTS = 3

/** How each language should sound, beyond "translate". */
const VOICE: Record<string, string> = {
  fr: "French, informal 'tu', as the existing French catalog does.",
  es: "Neutral international Spanish, informal 'tú'.",
  pt: "Brazilian Portuguese, informal 'você'.",
  ar: "Modern Standard Arabic, warm and plain.",
  yo: "Standard Yoruba with full tone marks and underdots (ẹ, ọ, ṣ). Keep widely used English tech words (app, chat, link) where a Yoruba speaker would.",
  ha: "Standard Hausa in Latin script (Boko) with the hooked letters (ɓ, ɗ, ƙ, ƴ). Keep widely used English tech words where a Hausa speaker would.",
  ig: "Standard Igbo with its dotted vowels and ṅ (ị, ọ, ụ, ṅ). Keep widely used English tech words where an Igbo speaker would.",
  sw: "Standard Swahili, friendly and plain.",
  hi: "Hindi in Devanagari, everyday register; common English tech loanwords (चैट, लिंक, ऐप) are fine.",
  zh: "Simplified Chinese (mainland), concise and friendly.",
  ja: "Japanese: short UI labels; full sentences in friendly です/ます.",
}

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === "string") out.set(prefix + k, v)
    else for (const [kk, vv] of flatten(v, `${prefix}${k}.`)) out.set(kk, vv)
  }
  return out
}

/** Rebuilds the tree in English's key order (stable diffs). */
function unflatten(order: Tree, values: Map<string, string>, prefix = ""): Tree {
  const out: Tree = {}
  for (const [k, v] of Object.entries(order)) {
    const path = prefix + k
    if (typeof v === "string") {
      const value = values.get(path)
      if (value !== undefined) out[k] = value
    } else {
      const child = unflatten(v, values, `${path}.`)
      if (Object.keys(child).length) out[k] = child
    }
  }
  return out
}

/** The arguments a message uses, with plural/select kinds ("count:plural"). */
function shapeOf(elements: MessageFormatElement[], into = new Set<string>()): Set<string> {
  for (const el of elements) {
    if (el.type === TYPE.argument || el.type === TYPE.number) into.add(el.value)
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      into.add(`${el.value}:${el.type === TYPE.plural ? "plural" : "select"}`)
      for (const option of Object.values(el.options)) shapeOf(option.value, into)
    }
    if (el.type === TYPE.tag) {
      into.add(`<${el.value}>`)
      shapeOf(el.children, into)
    }
  }
  return into
}

const hasOther = (elements: MessageFormatElement[]): boolean =>
  elements.every((el) =>
    el.type === TYPE.plural || el.type === TYPE.select
      ? "other" in el.options && Object.values(el.options).every((o) => hasOther(o.value))
      : el.type === TYPE.tag
        ? hasOther(el.children)
        : true,
  )

/** Why a translation can't be used, or null when it keeps the English message's shape. */
function problem(english: string, translated: string): string | null {
  if (!translated.trim()) return "empty"
  try {
    const want = [...shapeOf(parse(english))].sort().join(",")
    const tree = parse(translated)
    const got = [...shapeOf(tree)].sort().join(",")
    if (want !== got) return `arguments differ: English has [${want}], yours has [${got}]`
    if (!hasOther(tree)) return "every plural/select needs an `other` branch"
    return null
  } catch (e) {
    return `doesn't parse as an ICU message: ${(e as Error).message}`
  }
}

const result = z.object({
  items: z.array(z.object({ key: z.string(), text: z.string() })),
})

async function translateChunk(
  language: string,
  voice: string,
  entries: [string, string][],
  notes: Map<string, string>,
): Promise<Map<string, string>> {
  const lines = entries.map(([key, text]) => {
    const note = notes.get(key)
    return JSON.stringify({ key, english: text, ...(note ? { fix: note } : {}) })
  })
  const { output } = await generateText({
    model: agentModel(),
    instructions: `You translate the interface of Najimi, a taste copilot: it knows what people love (through Qloo) and makes things for their real lives (rooms, meals, playlists, outfits). Translate each English string into ${language}. ${voice}
Rules:
- Same meaning, same warmth, same length or shorter. Buttons and labels stay short.
- These are ICU messages. Keep every {argument} exactly as written, untranslated. In {x, plural, ...} and {x, select, ...}, keep the keyword structure and translate only the text inside the branches; use the plural categories ${language} needs (CLDR), always including "other". Keep "#" where it is.
- Never translate: Najimi, Qloo, IDDSI, FDA, Google, URLs, and the symbols … · →.
- When an item has "fix", your previous attempt was rejected for that reason; correct it.
Return one item per key, with the same key.`,
    prompt: lines.join("\n"),
    output: Output.object({ schema: result }),
    maxOutputTokens: 16_000,
    providerOptions: { openai: { reasoningEffort: "low" } },
  })
  return new Map(output.items.map((i) => [i.key, i.text]))
}

async function translateLocale(code: string, english: Tree, sources: Sources): Promise<void> {
  const meta = LOCALES.find((l) => l.code === code)
  if (!meta || code === "en") throw new Error(`Not a target language: ${code}`)
  const path = join(DIR, `${code}.json`)
  const existing: Tree = await readFile(path, "utf8")
    .then((s) => JSON.parse(s) as Tree)
    .catch(() => ({}))
  const en = flatten(english)
  const done = flatten(existing)
  // A catalog from before this file existed counts as translated from today's English.
  sources[code] ??= Object.fromEntries([...done.keys()].map((k) => [k, en.get(k) ?? ""]))
  const from = sources[code]
  let todo = [...en].filter(([key, text]) => !done.has(key) || from[key] !== text)
  const notes = new Map<string, string>()
  console.log(`[${code}] ${todo.length} to translate`)

  for (let attempt = 1; attempt <= ATTEMPTS && todo.length; attempt++) {
    const failed: [string, string][] = []
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK)
      const got = await translateChunk(meta.name, VOICE[code] ?? "", chunk, notes).catch((e) => {
        console.error(`[${code}] chunk failed`, (e as Error).message)
        return new Map<string, string>()
      })
      for (const [key, english] of chunk) {
        const text = got.get(key)
        const why = text === undefined ? "missing from your answer" : problem(english, text)
        if (why || text === undefined) {
          notes.set(key, why ?? "missing")
          failed.push([key, english])
        } else {
          done.set(key, text)
          from[key] = english
        }
      }
    }
    console.log(
      `[${code}] attempt ${attempt}: ${todo.length - failed.length} ok, ${failed.length} again`,
    )
    todo = failed
  }
  await writeFile(path, `${JSON.stringify(unflatten(english, done), null, 2)}\n`)
  if (todo.length) console.log(`[${code}] left in English: ${todo.map(([k]) => k).join(", ")}`)
}

async function main() {
  const codes = process.argv.slice(2)
  if (!codes.length) throw new Error("Name the languages: es pt yo …")
  const english = JSON.parse(await readFile(join(DIR, "en.json"), "utf8")) as Tree
  const sources = await readFile(SOURCES, "utf8")
    .then((s) => JSON.parse(s) as Sources)
    .catch(() => ({}) as Sources)
  const results = await Promise.allSettled(codes.map((c) => translateLocale(c, english, sources)))
  for (const [i, r] of results.entries())
    if (r.status === "rejected") console.error(`[${codes[i]}]`, r.reason)
  // Only keys English still has.
  const keys = new Set(flatten(english).keys())
  for (const code of Object.keys(sources))
    sources[code] = Object.fromEntries(
      Object.entries(sources[code] ?? {}).filter(([k]) => keys.has(k)),
    )
  await writeFile(SOURCES, `${JSON.stringify(sources, null, 2)}\n`)
}

main()
