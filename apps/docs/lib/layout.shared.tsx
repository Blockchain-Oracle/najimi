import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared"
import { Orb } from "@/components/orb"
import { QlooLogo } from "@/components/qloo-logo"
import { DOCS, SITE } from "./site"

/** The one filled action in the bar, ink on the frame like the app's own buttons. */
const openApp: LinkItemType = {
  type: "custom",
  secondary: true,
  children: (
    <a
      href={SITE.app}
      className="inline-flex h-8 items-center rounded-full bg-fd-primary px-3.5 text-[13px] font-semibold whitespace-nowrap text-fd-primary-foreground transition-opacity hover:opacity-85"
    >
      Open Najimi
    </a>
  ),
}

/** The bar on every page: Najimi (its orb) beside Qloo's wordmark, GitHub, and the app. */
export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: SITE.repo,
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <Orb size={22} />
          <span className="font-display text-[17px] font-extrabold tracking-[-0.02em]">
            {SITE.name}
          </span>
          <span aria-hidden className="h-4 w-px bg-fd-border" />
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-fd-muted-foreground">
            on <QlooLogo className="h-[0.95em]" />
          </span>
        </span>
      ),
      url: "/",
    },
    links: [openApp],
  }
}

/** The home page's bar also names the docs' sections (inside the docs they're the tabs). */
export function homeOptions(): BaseLayoutProps {
  const base = baseOptions()
  return {
    ...base,
    links: [
      { text: "Guide", url: DOCS.start, active: "nested-url" },
      { text: "The agent", url: DOCS.agent, active: "nested-url" },
      { text: "Qloo", url: DOCS.qloo, active: "nested-url" },
      { text: "Build", url: DOCS.build, active: "nested-url" },
      openApp,
    ],
  }
}
