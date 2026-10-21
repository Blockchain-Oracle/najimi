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

export const WORKFLOW_SLUGS = Object.keys(WORKFLOW_LOOK)
