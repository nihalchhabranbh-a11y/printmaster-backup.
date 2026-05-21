import React from "react";
import { cn } from "./cn";

export const Card = React.forwardRef(function Card({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("rounded-2xl border border-border bg-background text-foreground shadow-sm", className)}
      {...props}
    />
  );
});

