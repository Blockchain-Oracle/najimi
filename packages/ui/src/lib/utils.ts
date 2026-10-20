import type { CnFunction } from "cn"
import { createCn } from "cn/config"

/**
 * Class merging that knows our custom tokens. The stock `cn` treats unknown `text-*` names as
 * colours, so a display size would silently drop when merged with a colour.
 * Keep these lists in step with the --text-* and --radius-* names in packages/tokens/tokens.json.
 * Components import cn from here, never from "cn" directly (Biome enforces it).
 */
export const cn: CnFunction = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-sm", "display", "display-lg"] }],
      rounded: [{ rounded: ["card", "nav", "pill", "tag"] }],
    },
  },
})
