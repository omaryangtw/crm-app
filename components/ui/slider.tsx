"use client";

import * as React from "react";
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider<Value extends number | readonly number[]>({
  className,
  ...props
}: SliderPrimitive.Root.Props<Value> & { className?: string }) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn("flex w-full touch-none flex-col gap-1", className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex h-5 items-center">
        <SliderPrimitive.Track className="relative h-1.5 w-full rounded-full bg-muted">
          <SliderPrimitive.Indicator className="rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-4 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
