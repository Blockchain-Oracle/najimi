import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared"

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: <span className="font-semibold tracking-[0.06em]">Najimi</span>, url: "/" },
  }
}
