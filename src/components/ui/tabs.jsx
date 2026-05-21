import React, { createContext, useContext, useMemo } from "react";
import { cn } from "./cn";

const TabsContext = createContext(null);

export function Tabs({ value, onValueChange, className, children }) {
  const ctx = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }) {
  return (
    <div
      className={cn("grid gap-1 rounded-xl border border-border bg-secondary/20 p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ value, className, children, ...props }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      className={cn(
        "h-9 rounded-lg px-3 text-sm font-semibold transition",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      onClick={() => ctx?.onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className, children }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;
  return <div className={className}>{children}</div>;
}

