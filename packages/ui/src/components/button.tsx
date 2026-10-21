import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cn } from "@najimi/ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

/*
 * The OurSpaces pill: sentence case, semibold, a hard sticker shadow under the action that presses
 * down when tapped. A button's words say what will happen ("Show me my taste"), never "Submit".
 * Lime is the one action per view; paper and sticker are the quiet ones.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-pill border border-transparent text-sm font-semibold whitespace-nowrap transition-[background-color,color,border-color,opacity,translate,box-shadow] duration-(--motion-quick) ease-(--motion-ease-out) outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sticker hover:-translate-y-px hover:shadow-sticker-lift active:translate-y-0.5 active:shadow-none",
        paper:
          "bg-card text-card-foreground shadow-sticker hover:-translate-y-px active:translate-y-0.5 active:shadow-none",
        sticker:
          "bg-sticker text-sticker-foreground shadow-sticker hover:-translate-y-px active:translate-y-0.5 active:shadow-none",
        outline:
          "border-foreground/25 bg-transparent text-foreground hover:border-foreground aria-expanded:border-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/85",
        link: "h-auto px-0 text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground",
      },
      size: {
        default:
          "h-10 gap-2 px-5 has-data-[icon=inline-end]:pe-4 has-data-[icon=inline-start]:ps-4",
        sm: "h-8 gap-1.5 px-3.5 text-[13px] has-data-[icon=inline-end]:pe-3 has-data-[icon=inline-start]:ps-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pe-5 has-data-[icon=inline-start]:ps-5",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
