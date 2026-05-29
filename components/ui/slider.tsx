"use client"

import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  orientation = "horizontal",
  ...props
}: SliderPrimitive.Root.Props<number>) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      orientation={orientation}
      className={cn(
        "relative flex touch-none items-center select-none data-disabled:opacity-50",
        "data-[orientation=horizontal]:w-full",
        // Vertical sliders rely on the consumer to set a height — we can't
        // default to h-full here because that wins via specificity over an
        // explicit h-* override on this Root.
        "data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "group/slider-control relative flex grow items-center justify-center",
          "data-[orientation=horizontal]:h-5 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-5",
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            "relative overflow-hidden rounded-full bg-muted",
            "data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full",
            "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
          )}
        >
          {/* Indicator size + anchor (bottom for vertical, inline-start for
              horizontal) comes from base-ui inline styles; we just paint it. */}
          <SliderPrimitive.Indicator className="bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-3.5 shrink-0 rounded-full border border-primary/50 bg-background shadow-sm outline-none ring-ring/50 transition-[box-shadow,transform] group-hover/slider-control:scale-110 hover:ring-4 focus-visible:ring-4 data-disabled:pointer-events-none data-disabled:opacity-50" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
