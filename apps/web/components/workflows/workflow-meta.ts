import { BUILT_IN_WORKFLOWS } from "@najimi/agent/workflows"
import { BookOpen, ChefHat, Clapperboard, Lamp, Shirt, Sofa, Wine } from "lucide-react"

/** Each built-in workflow's mark: an icon in ink. Workflows carry no colour of their own. */
export const WORKFLOW_ICON: Record<string, typeof Lamp> = {
  "relight-my-room": Lamp,
  "make-it-mine": Sofa,
  "cook-for": ChefHat,
  "next-read": BookOpen,
  "dress-me": Shirt,
  "my-taste-film": Clapperboard,
  "night-in": Wine,
}

/** The built-ins this server offers, in their order (the film only while video is on). */
export const WORKFLOW_SLUGS = BUILT_IN_WORKFLOWS.map((w) => w.slug).filter(
  (s) => s in WORKFLOW_ICON,
)
