import { docsLlms } from "@/lib/source"

export const revalidate = false

/** Every page's text in one file, for language models. */
export async function GET() {
  return new Response(await docsLlms.full(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
