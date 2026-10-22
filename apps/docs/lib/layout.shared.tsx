import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"
import { QlooLogo } from "@/components/qloo-logo"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <span className="font-semibold tracking-[0.06em]">Najimi</span>
          <span aria-hidden className="h-4 w-px bg-fd-border" />
          <QlooLogo className="h-[0.85em] text-fd-muted-foreground" />
        </span>
      ),
      url: "/",
    },
  }
}
