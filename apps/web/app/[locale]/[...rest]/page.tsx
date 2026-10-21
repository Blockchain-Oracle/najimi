import { notFound } from "next/navigation"

/** Any path no page claims: the localised not-found page. */
export default function CatchAll() {
  notFound()
}
