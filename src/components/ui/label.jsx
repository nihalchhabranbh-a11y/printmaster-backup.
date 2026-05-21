import React from "react";
import { cn } from "./cn";

export const Label = React.forwardRef(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
});

