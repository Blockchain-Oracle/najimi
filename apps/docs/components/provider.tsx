"use client"

import { RootProvider } from "fumadocs-ui/provider/next"
import type { ReactNode } from "react"
import SearchDialog from "./search"

/** Light by default with a real dark mode, like the app; search runs over a prebuilt index. */
export function Provider({ children }: { children: ReactNode }) {
  return (
    <RootProvider search={{ SearchDialog }} theme={{ defaultTheme: "light" }}>
      {children}
    </RootProvider>
  )
}
