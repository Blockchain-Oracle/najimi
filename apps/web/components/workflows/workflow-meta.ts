import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { BookOpen, ChefHat, Clapperboard, Lamp, Shirt, Sofa, Wine } from "lucide-react"

/** How each built-in workflow looks: an icon and its identity colour. */
export const WORKFLOW_LOOK: Record<string, { icon: typeof Lamp; tone: string }> = {
  "relight-my-room": { icon: Lamp, tone: "bg-butter" },
  "make-it-mine": { icon: Sofa, tone: "bg-pink" },
  "cook-for": { icon: ChefHat, tone: "bg-orange" },
  "next-read": { icon: BookOpen, tone: "bg-teal" },
  "dress-me": { icon: Shirt, tone: "bg-violet" },
  "my-taste-film": { icon: Clapperboard, tone: "bg-cobalt" },
  "night-in": { icon: Wine, tone: "bg-lime" },
}

/** The built-ins this server offers, in their order (the film only while video is on). */
export const WORKFLOW_SLUGS = BUILT_IN_WORKFLOWS.map((w) => w.slug).filter(
  (s) => s in WORKFLOW_LOOK,
)
