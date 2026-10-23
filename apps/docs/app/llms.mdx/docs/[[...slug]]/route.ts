import { notFound } from "next/navigation"
import { docsLlms, source } from "@/lib/source"

export const revalidate = false

type Context = { params: Promise<{ slug?: string[] }> }

/** One page as Markdown (…/content.md), behind "Copy Markdown" and "Open in ChatGPT / Claude". */
export async function GET(_req: Request, { params }: Context) {
  const slugs = (await params).slug?.slice(0, -1) ?? []
  const page = source.getPage(slugs)
  if (!page) notFound()
  return new Response(await docsLlms.page(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  })
}

export function generateStaticParams() {
  return source.generateParams().map((item) => ({ slug: [...(item.slug ?? []), "content.md"] }))
}
