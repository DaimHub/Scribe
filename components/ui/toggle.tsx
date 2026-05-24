"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-background data-pressed:text-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        sm: "h-8 px-2 min-w-8 text-xs",
        xs: "h-7 px-2 min-w-7 text-xs",
        lg: "h-10 px-3 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

type ToggleOwnProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof toggleVariants> & {
    pressed?: boolean
    defaultPressed?: boolean
    onPressedChange?: (pressed: boolean) => void
  }

function Toggle({ className, variant, size, ...props }: ToggleOwnProps) {
  // The base-ui Toggle component accepts these props; we use a generic forward
  // here because TogglePrimitive is generic on its value type.
  const Comp = TogglePrimitive as unknown as React.ComponentType<ToggleOwnProps>
  return (
    <Comp
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
