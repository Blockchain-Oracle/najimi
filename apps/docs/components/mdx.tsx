import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import { Flow, Layers } from "./flow"
import { QlooLogo } from "./qloo-logo"

export function getMDXComponents(components?: MDXComponents) {
  return { ...defaultMdxComponents, Flow, Layers, QlooLogo, ...components } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
