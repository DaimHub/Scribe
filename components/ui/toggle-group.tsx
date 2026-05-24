"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Toggle, toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: "default",
  variant: "default",
})

type ToggleGroupOwnProps = React.ComponentPropsWithoutRef<"div"> &
  VariantProps<typeof toggleVariants> & {
    value?: string | string[] | null
    defaultValue?: string | string[] | null
    onValueChange?: (value: string[]) => void
    toggleMultiple?: boolean
  }

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupOwnProps) {
  const Comp = ToggleGroupPrimitive as unknown as React.ComponentType<ToggleGroupOwnProps>
  return (
    <Comp
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </Comp>
  )
}

type ToggleGroupItemProps = React.ComponentProps<typeof Toggle> & {
  value: string
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: ToggleGroupItemProps) {
  const ctx = React.useContext(ToggleGroupContext)
  return (
    <Toggle
      data-slot="toggle-group-item"
      variant={ctx.variant ?? variant}
      size={ctx.size ?? size}
      className={cn("rounded-sm", className)}
      {...props}
    >
      {children}
    </Toggle>
  )
}

export { ToggleGroup, ToggleGroupItem }
