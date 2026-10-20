/** The Your People report as the page receives it (JSON of the people_reports row). */
export type ReportItem = {
  entityId: string
  name: string
  subtype: string | null
  image: string | null
  affinity: number | null
  popularity: number | null
  tags: string[]
}

export type Section<T> = { data: T; callId: string | null; error?: string } | null

export type HeatCell = {
  geohash: string
  lat: number
  lon: number
  affinity: number
  popularity: number
}
export type Area = {
  name: string
  geohash: string
  lat: number
  lon: number
  affinity: number
  popularity: number
  cells: string[]
}

export type Report = {
  id: string
  businessId: string
  runId: string | null
  status: "building" | "ready" | "failed" | "unavailable"
  basis: {
    route: "own" | "comparables"
    entities: { entityId: string; name: string }[]
    city: string | null
  }
  domains: Record<string, NonNullable<Section<ReportItem[]>>>
  demographics: Section<{ age: Record<string, number>; gender: Record<string, number> }>
  heatmap: Section<{ location: string; cells: HeatCell[]; areas: Area[] }>
  vocabulary: Section<{ name: string; type: string | null; affinity: number | null }[]>
  rising: Section<{
    entity: string
    points: { date: string; percentile: number | null; delta: number | null }[]
  }>
  compare: Section<{ against: string; items: ReportItem[] }>
  error: string | null
  shareToken: string | null
  createdAt: string
}
