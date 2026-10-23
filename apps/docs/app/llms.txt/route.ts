import { docsLlms } from "@/lib/source"

export const revalidate = false

/** An index of every page for language models; the full text is at /llms-full.txt. */
export async function GET() {
  return new Response(await docsLlms.index(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
