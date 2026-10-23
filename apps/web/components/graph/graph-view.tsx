"use client"

import { TASTE } from "@najimi/config"
import { Orb } from "@najimi/ui/components/orb"
import { toast } from "@najimi/ui/components/sonner"
import { cn } from "@najimi/ui/lib/utils"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Download, History, Loader2, RotateCcw, Sparkles, Users } from "lucide-react"
import dynamic from "next/dynamic"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useReportScreen } from "@/components/agent/agent-context"
import { api } from "@/lib/fetcher"
import { sound } from "@/lib/sounds"
import { useRunEvents } from "@/lib/use-run"
import { type GraphNode, NodeSheet } from "./node-sheet"

/*
 * The Graph (W13): you in the middle, your loves round you, and the things Qloo picked for you
 * beyond, each tied to the loves that brought it (thicker the bigger that love's share, with light
 * running along the ties). Pull a node and the rest springs back. Tap one: turn a love up or down
 * and the picks it carries grow or fade at once (Qloo's explainability), then make it real and Qloo
 * refines the whole taste; grow the graph from any node; lay a friend's taste over yours and what
 * you share glows; slide back through when each love arrived.
 */

// Client only (canvas and d3), loaded with the screen; typed as the library's own component.
const ForceGraph = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as typeof import("react-force-graph-2d").default

type Love = {
  id: string
  qlooId: string
  name: string
  type: string
  weight: number
  image: string | null
  at: string
}
type Pick = {
  qlooId: string
  type: string
  domain: string
  name: string
  image: string | null
  caption: string | null
  affinity: number | null
  shares: { id: string; share: number }[]
}
type Graph = {
  person: { id: string; name: string; look: string | null; mine: boolean }
  lenses: { people: { who: string; name: string; look: string | null }[] }
  loves: Love[]
  picks: Pick[]
}
type Grown = { from: string; nodes: Omit<Pick, "domain" | "shares">[] }

/** One hue per family of things (the graph's colour is category, W13), in the app's own palette. */
const FAMILY: Record<string, string> = {
  artist: "#FF4FA3",
  podcast: "#FF4FA3",
  movie: "#8B5CFF",
  tv_show: "#8B5CFF",
  videogame: "#8B5CFF",
  place: "#FFB23E",
  destination: "#FFB23E",
  book: "#3F70FF",
  brand: "#13B8A6",
}
const keyOf = (type: string) => type.replace("urn:entity:", "")
const colourOf = (type: string) => FAMILY[keyOf(type)] ?? "#F5F5F7"

/** Artwork through the image optimiser: small, cached, and same-origin (the canvas stays saveable). */
const thumb = (url: string | null) =>
  url ? `/_next/image?url=${encodeURIComponent(url)}&w=128&q=70` : null

const images = new Map<string, HTMLImageElement>()
function imageFor(url: string | null) {
  const src = thumb(url)
  if (!src) return null
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.src = src
    images.set(src, img)
  }
  return img.complete && img.naturalWidth ? img : null
}

/** A d3 force that pulls each node toward its ring round the centre (loves, then picks, then grown). */
function ringForce(radiusOf: (n: Node) => number, strength = 0.14) {
  let nodes: Node[] = []
  const force = (alpha: number) => {
    for (const n of nodes) {
      if (n.fx != null || n.x == null || n.y == null) continue
      const d = Math.hypot(n.x, n.y) || 1
      const k = ((radiusOf(n) - d) / d) * strength * alpha
      const node = n as Node & { vx?: number; vy?: number }
      node.vx = (node.vx ?? 0) + n.x * k
      node.vy = (node.vy ?? 0) + n.y * k
    }
  }
  force.initialize = (all: Node[]) => {
    nodes = all
  }
  return force
}

/** A face from public/looks, for the middle node. */
function lookImage(look: string | null) {
  if (!look) return null
  const src = `/looks/${look}.png`
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.src = src
    images.set(src, img)
  }
  return img.complete && img.naturalWidth ? img : null
}

type Node = GraphNode & { x?: number; y?: number; fx?: number; fy?: number; size: number }
type Link = {
  source: string | Node
  target: string | Node
  share: number
  kind: "love" | "pick" | "grown"
}

export function GraphView() {
  const t = useTranslations("Graph")
  const queryClient = useQueryClient()
  const box = useRef<HTMLDivElement>(null)
  // biome-ignore lint/suspicious/noExplicitAny: react-force-graph's instance methods
  const fg = useRef<any>(null)
  const [size, setSize] = useState({ w: 360, h: 640 })
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [selected, setSelected] = useState<Node | null>(null)
  const [grown, setGrown] = useState<Grown[]>([])
  const [growing, setGrowing] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<string | null>(null)
  const [until, setUntil] = useState<number | null>(null)
  const [timeline, setTimeline] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)

  const graph = useQuery({
    queryKey: ["graph", "me"],
    queryFn: () => api<Graph>("/api/graph?who=me"),
  })
  const friends = { data: graph.data?.lenses.people }
  const theirs = useQuery({
    queryKey: ["graph", overlay],
    queryFn: () => api<Graph>(`/api/graph?who=${encodeURIComponent(overlay ?? "")}`),
    enabled: Boolean(overlay),
  })
  const run = useRunEvents(runId)
  useEffect(() => {
    if (run.status !== "done") return
    setRunId(null)
    setWeights({})
    void queryClient.invalidateQueries({ queryKey: ["graph", "me"] })
    toast(t("refined"))
  }, [run.status, queryClient, t])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const data = graph.data
  const weightOf = useCallback((l: Love) => weights[l.qlooId] ?? l.weight, [weights])

  /** A pick's strength now: its affinity, scaled by how its loves' weights moved (explainability). */
  const strengthOf = useCallback(
    (p: { affinity: number | null; shares: { id: string; share: number }[] }) => {
      const base = p.affinity ?? 0.8
      if (!data || !p.shares.length) return base
      const byId = new Map(data.loves.map((l) => [l.qlooId, l]))
      let total = 0
      let moved = 0
      for (const s of p.shares) {
        const love = byId.get(s.id)
        if (!love) continue
        total += s.share
        moved += s.share * (weightOf(love) / Math.max(love.weight, 1))
      }
      return total ? base * (moved / total) : base
    },
    [data, weightOf],
  )

  const shared = useMemo(() => {
    const other = theirs.data
    if (!other) return null
    return new Set([...other.loves.map((l) => l.qlooId), ...other.picks.map((p) => p.qlooId)])
  }, [theirs.data])

  const firstAt = data?.loves.length ? new Date(data.loves[0]?.at ?? 0).getTime() : 0
  const lastAt = Date.now()

  const graphData = useMemo(() => {
    if (!data) return { nodes: [] as Node[], links: [] as Link[] }
    const shown = (l: Love) => until === null || new Date(l.at).getTime() <= until
    const loves = data.loves.filter(shown)
    const loveIds = new Set(loves.map((l) => l.qlooId))
    const maxW = Math.max(1, ...loves.map(weightOf))
    const nodes: Node[] = [
      // You stay in the middle; everything else finds its place round you.
      {
        id: "me",
        kind: "me",
        name: data.person.name,
        image: null,
        type: "",
        size: 20,
        fx: 0,
        fy: 0,
      },
      ...loves.map(
        (l): Node => ({
          id: l.qlooId,
          kind: "love",
          name: l.name,
          image: l.image,
          type: l.type,
          size: 7 + (weightOf(l) / TASTE.weightMax) * 9,
          weight: weightOf(l),
          loveId: l.id,
          glow: shared?.has(l.qlooId) ?? false,
        }),
      ),
    ]
    const links: Link[] = loves.map((l) => ({
      source: "me",
      target: l.qlooId,
      share: weightOf(l) / maxW,
      kind: "love",
    }))
    for (const p of data.picks) {
      if (loveIds.has(p.qlooId) || nodes.some((n) => n.id === p.qlooId)) continue
      const ties = p.shares
        .filter((s) => loveIds.has(s.id) && s.share > 0.05)
        .sort((a, b) => b.share - a.share)
        .slice(0, 2)
      if (!ties.length) continue
      const strength = strengthOf(p)
      const ratio = strength / Math.max(p.affinity ?? 0.8, 0.01)
      nodes.push({
        id: p.qlooId,
        kind: "pick",
        name: p.name,
        image: p.image,
        type: p.type,
        caption: p.caption,
        size: Math.max(2.5, 4 + 3 * ratio),
        fade: Math.max(0.15, Math.min(1, ratio)),
        because: ties.map((s) => ({
          name: data.loves.find((l) => l.qlooId === s.id)?.name ?? "",
          share: s.share,
        })),
        glow: shared?.has(p.qlooId) ?? false,
      })
      // One tie drawn per pick (its strongest love), so picks gather round the love that brought them.
      const top = ties[0] as { id: string; share: number }
      links.push({ source: top.id, target: p.qlooId, share: top.share * ratio, kind: "pick" })
    }
    for (const g of grown) {
      if (!nodes.some((n) => n.id === g.from)) continue
      for (const n of g.nodes) {
        if (nodes.some((x) => x.id === n.qlooId)) continue
        nodes.push({
          id: n.qlooId,
          kind: "grown",
          name: n.name,
          image: n.image,
          type: n.type,
          caption: n.caption,
          size: 4,
          glow: shared?.has(n.qlooId) ?? false,
        })
        links.push({ source: g.from, target: n.qlooId, share: 0.5, kind: "grown" })
      }
    }
    return { nodes, links }
  }, [data, until, weightOf, strengthOf, grown, shared])

  // Spread the rings once the graph exists (it loads after the page): loves close, picks further.
  const spread = useCallback(() => {
    const instance = fg.current
    if (!instance || instance.__spread) return
    instance.__spread = true
    instance.d3Force("charge")?.strength((n: Node) => (n.kind === "love" ? -260 : -90))
    instance
      .d3Force("link")
      ?.distance((l: Link) => (l.kind === "love" ? 130 : l.kind === "pick" ? 90 : 60))
      .strength((l: Link) => (l.kind === "love" ? 0.5 : l.kind === "grown" ? 0.6 : 0.3))
    instance.d3Force(
      "rings",
      ringForce((n) =>
        n.kind === "me" ? 0 : n.kind === "love" ? 130 : n.kind === "pick" ? 270 : 360,
      ),
    )
    instance.d3ReheatSimulation()
  }, [])

  useReportScreen(
    selected
      ? {
          where: "graph",
          label: `${selected.name} on their taste graph`,
          qlooId: selected.kind === "me" ? undefined : selected.id,
        }
      : data
        ? { where: "graph", label: "their taste graph" }
        : null,
  )

  const changed = Object.entries(weights).filter(
    ([id, w]) => data?.loves.find((l) => l.qlooId === id)?.weight !== w,
  )

  const commit = async () => {
    if (!data || !changed.length) return
    sound("check")
    try {
      let last: string | null = null
      for (const [qlooId, weight] of changed) {
        const love = data.loves.find((l) => l.qlooId === qlooId)
        if (!love) continue
        const r = await api<{ runId: string }>(`/api/people/${data.person.id}/loves/${love.id}`, {
          method: "PATCH",
          json: { weight },
        })
        last = r.runId
      }
      setRunId(last)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    }
  }

  const grow = async (node: Node) => {
    if (node.kind === "me" || !node.type) return
    setGrowing(node.id)
    try {
      const r = await api<{ nodes: Grown["nodes"] }>(
        `/api/graph/expand?id=${encodeURIComponent(node.id)}&type=${encodeURIComponent(node.type)}&name=${encodeURIComponent(node.name)}`,
      )
      setGrown((g) => [...g, { from: node.id, nodes: r.nodes }])
      sound("place")
      setSelected(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : t("error"))
    } finally {
      setGrowing(null)
    }
  }

  const save = async () => {
    const canvas = box.current?.querySelector("canvas")
    if (!canvas) return
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) throw new Error()
      const file = new File([blob], "my-taste-graph.png", { type: "image/png" })
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: t("title") })
      else {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch {
      toast(t("saveFailed"))
    }
  }

  const paint = useCallback((node: Node, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = node.x ?? 0
    const y = node.y ?? 0
    const r = node.size
    ctx.save()
    ctx.globalAlpha = node.fade ?? 1
    if (node.glow) {
      ctx.shadowColor = "#FF5CA8"
      ctx.shadowBlur = 18
    }
    ctx.beginPath()
    ctx.arc(x, y, r + (node.kind === "me" ? 3 : 1.6), 0, Math.PI * 2)
    ctx.fillStyle = node.kind === "me" ? "#FF5CA8" : node.glow ? "#FF5CA8" : colourOf(node.type)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.closePath()
    ctx.fillStyle = "#131315"
    ctx.fill()
    const img = node.kind === "me" ? lookImage(node.look ?? null) : imageFor(node.image)
    if (img) {
      ctx.save()
      ctx.clip()
      ctx.drawImage(img, x - r, y - r, r * 2, r * 2)
      ctx.restore()
    } else if (node.kind !== "me") {
      ctx.fillStyle = "#F5F5F7"
      ctx.font = `600 ${r * 0.9}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(node.name.slice(0, 1), x, y)
    }
    // Names show when there's room to read them.
    const labelled = node.kind === "me" || node.kind === "love" || scale > 2.2
    if (labelled) {
      const fontSize = Math.max(10 / scale, node.kind === "love" ? 3.6 : 2.6)
      ctx.font = `600 ${fontSize}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      const label = node.name.length > 22 ? `${node.name.slice(0, 21)}…` : node.name
      ctx.fillStyle = "rgba(0,0,0,0.6)"
      const w = ctx.measureText(label).width
      ctx.fillRect(x - w / 2 - 1.5, y + r + 2, w + 3, fontSize + 2)
      ctx.fillStyle = "#F5F5F7"
      ctx.fillText(label, x, y + r + 3)
    }
    ctx.restore()
  }, [])

  const face = data?.person.look ?? null

  const nodes = graphData.nodes.map((n) => (n.kind === "me" ? { ...n, look: face } : n))

  return (
    <div className="dark fixed inset-0 bg-[#07060c] text-foreground md:start-[5.5rem]">
      <div ref={box} className="absolute inset-0">
        {data ? (
          <ForceGraph<Node, Link>
            ref={fg}
            width={size.w}
            height={size.h}
            graphData={{ nodes, links: graphData.links }}
            backgroundColor="#07060c"
            nodeId="id"
            nodeRelSize={1}
            nodeVal={(n: Node) => n.size * n.size}
            nodeCanvasObject={paint}
            nodePointerAreaPaint={(n: Node, color: string, ctx: CanvasRenderingContext2D) => {
              ctx.fillStyle = color
              ctx.beginPath()
              ctx.arc(n.x ?? 0, n.y ?? 0, n.size + 3, 0, Math.PI * 2)
              ctx.fill()
            }}
            linkColor={(l: Link) =>
              l.kind === "love"
                ? "rgba(255,92,168,0.45)"
                : l.kind === "grown"
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.22)"
            }
            linkWidth={(l: Link) => 0.4 + l.share * 2.6}
            linkDirectionalParticles={(l: Link) => (l.kind === "grown" ? 1 : 2)}
            linkDirectionalParticleWidth={(l: Link) => 1 + l.share * 2}
            linkDirectionalParticleSpeed={(l: Link) => 0.002 + l.share * 0.006}
            linkDirectionalParticleColor={() => "#FFB23E"}
            cooldownTicks={160}
            onEngineTick={spread}
            onEngineStop={() => {
              if (!fg.current?.__fitted) {
                fg.current.__fitted = true
                fg.current.zoomToFit(600, 60)
              }
            }}
            onNodeClick={(n: Node) => {
              sound("tap")
              setSelected(n)
              // The node sits in the top part of the screen, clear of its sheet.
              const zoom = fg.current?.zoom?.() ?? 1
              fg.current?.centerAt(n.x, (n.y ?? 0) + (size.h * 0.22) / zoom, 600)
            }}
            onBackgroundClick={() => setSelected(null)}
          />
        ) : (
          <div className="grid size-full place-items-center">
            <Orb size={88} working />
          </div>
        )}
      </div>

      {/* Title, what-if bar, friends to lay over, history. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 p-4 pt-[max(env(safe-area-inset-top),16px)]">
        <div className="pointer-events-auto flex items-center gap-2">
          <h1 className="font-title text-[1.75rem] leading-none">{t("title")}</h1>
          <span className="ms-auto flex gap-2">
            <button
              type="button"
              onClick={() => setTimeline((v) => !v)}
              aria-pressed={timeline}
              aria-label={t("history")}
              title={t("history")}
              className={cn(
                "grid size-10 place-items-center rounded-full",
                timeline ? "bg-foreground text-background" : "glass",
              )}
            >
              <History className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => void save()}
              aria-label={t("save")}
              title={t("save")}
              className="glass grid size-10 place-items-center rounded-full"
            >
              <Download className="size-5" />
            </button>
          </span>
        </div>
        {friends.data?.length ? (
          <div className="pointer-events-auto -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-text-3">
              <Users className="size-4" />
              {t("overlay")}
            </span>
            {friends.data.map((f) => (
              <button
                key={f.who}
                type="button"
                aria-pressed={overlay === f.who}
                onClick={() => setOverlay((o) => (o === f.who ? null : f.who))}
                className={cn(
                  "h-8 shrink-0 rounded-pill px-3 text-[13px] font-semibold",
                  overlay === f.who ? "bg-signal text-signal-foreground" : "glass",
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        ) : null}
        {overlay && shared ? (
          <span className="glass pointer-events-auto w-fit rounded-pill px-3 py-1 text-[13px] font-semibold">
            {theirs.isFetching ? (
              <Loader2 className="inline size-4 animate-spin" />
            ) : (
              t("shareCount", { count: graphData.nodes.filter((n) => n.glow).length })
            )}
          </span>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] flex flex-col gap-2.5 p-4 md:bottom-0">
        {timeline && data?.loves.length ? (
          <div className="glass pointer-events-auto flex flex-col gap-1.5 rounded-card px-4 py-3">
            <div className="flex justify-between text-[12px] font-semibold text-text-3">
              <span>{t("then")}</span>
              <span>
                {until === null
                  ? t("now")
                  : new Date(until).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
              </span>
            </div>
            <input
              type="range"
              min={firstAt}
              max={lastAt}
              step={60_000}
              value={until ?? lastAt}
              onChange={(e) => {
                const v = Number(e.target.value)
                setUntil(v >= lastAt - 60_000 ? null : v)
              }}
              aria-label={t("history")}
              className="w-full accent-[var(--color-signal)]"
            />
          </div>
        ) : null}
        {changed.length ? (
          <div className="glass pointer-events-auto flex items-center gap-2 rounded-pill p-1.5 ps-4">
            <Sparkles className="size-4 shrink-0 text-signal" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
              {runId ? t("refining") : t("whatIf", { count: changed.length })}
            </span>
            <button
              type="button"
              onClick={() => setWeights({})}
              disabled={Boolean(runId)}
              aria-label={t("undo")}
              title={t("undo")}
              className="grid size-9 place-items-center rounded-full bg-white/10 disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => void commit()}
              disabled={Boolean(runId)}
              className="flex h-9 items-center gap-1.5 rounded-pill bg-foreground px-4 text-[13px] font-semibold text-background disabled:opacity-60"
            >
              {runId ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("makeReal")}
            </button>
          </div>
        ) : null}
      </div>

      <NodeSheet
        node={selected}
        onClose={() => setSelected(null)}
        mine={Boolean(data?.person.mine)}
        weight={
          selected?.kind === "love"
            ? (weights[selected.id] ?? selected.weight ?? TASTE.weightMin)
            : null
        }
        onWeight={(w) => {
          if (!selected) return
          setWeights((prev) => ({ ...prev, [selected.id]: w }))
        }}
        growing={growing === selected?.id}
        onGrow={() => selected && void grow(selected)}
      />
    </div>
  )
}
