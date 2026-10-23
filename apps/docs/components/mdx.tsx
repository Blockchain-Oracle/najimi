import { Accordion, Accordions } from "fumadocs-ui/components/accordion"
import { File, Files, Folder } from "fumadocs-ui/components/files"
import { ImageZoom } from "fumadocs-ui/components/image-zoom"
import { Step, Steps } from "fumadocs-ui/components/steps"
import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import { TypeTable } from "fumadocs-ui/components/type-table"
import defaultMdxComponents from "fumadocs-ui/mdx"
import { icons } from "lucide-react"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps } from "react"
import { BRANDS } from "@/lib/brands"
import { Flow, Layers, Stats } from "./flow"
import { Logo, LogoCloud } from "./logo-cloud"
import { Orb } from "./orb"
import { Phone, Phones, Shot } from "./phone"
import { QlooLogo } from "./qloo-logo"
import { Run } from "./run"

/** Every outside service Najimi works with, as the endless row. */
function Brands() {
  return <LogoCloud brands={BRANDS} />
}

/** A lucide icon by name, so .mdx files can write `icon={<Icon name="Bot" />}` without imports. */
function Icon({ name, ...props }: { name: keyof typeof icons } & ComponentProps<"svg">) {
  const Glyph = icons[name]
  // A name lucide doesn't have renders nothing rather than breaking the page.
  return Glyph ? <Glyph {...props} /> : null
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: (props: ComponentProps<"img">) => (
      <ImageZoom {...(props as ComponentProps<typeof ImageZoom>)} />
    ),
    Accordion,
    Accordions,
    Files,
    Folder,
    File,
    Step,
    Steps,
    Tab,
    Tabs,
    TypeTable,
    Flow,
    Layers,
    Stats,
    Brands,
    Logo,
    LogoCloud,
    Orb,
    Phone,
    Phones,
    Shot,
    QlooLogo,
    Run,
    Icon,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
