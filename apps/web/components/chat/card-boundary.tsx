"use client"

import { Component, type ReactNode } from "react"

/** One broken card never takes the conversation down with it. */
export class CardBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error("[card]", error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
