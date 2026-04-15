import React from "react";
import { cn } from "./cn";

export const Button = React.forwardRef(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref,
) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 disabled:opacity-60 disabled:pointer-events-none";

  const variants = {
    default: "bg-foreground text-background hover:opacity-90",
    outline: "border border-border bg-background hover:bg-secondary/40",
    ghost: "bg-transparent hover:bg-secondary/40",
  };

  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
    icon: "h-10 w-10 p-0",
  };

  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
});

