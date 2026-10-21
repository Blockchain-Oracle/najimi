import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { Flow, Layers } from "./flow"

export function getMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, Flow, Layers, ...components } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
