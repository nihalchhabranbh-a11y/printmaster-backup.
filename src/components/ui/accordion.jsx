import React, { createContext, useContext, useMemo } from "react";
import { cn } from "./cn";

const AccCtx = createContext(null);

export function Accordion({ type = "single", collapsible = false, value, onValueChange, className, children }) {
  const ctx = useMemo(() => ({ type, collapsible, value, onValueChange }), [type, collapsible, value, onValueChange]);
  return (
    <AccCtx.Provider value={ctx}>
      <div className={className}>{children}</div>
    </AccCtx.Provider>
  );
}

const ItemCtx = createContext(null);

export function AccordionItem({ value, className, children, ...props }) {
  return (
    <ItemCtx.Provider value={{ value }}>
      <div className={className} {...props}>
        {children}
      </div>
    </ItemCtx.Provider>
  );
}

export function AccordionTrigger({ className, children, ...props }) {
  const acc = useContext(AccCtx);
  const item = useContext(ItemCtx);
  const open = acc?.value === item?.value;
  return (
    <button
      type="button"
      className={cn("flex w-full items-center justify-between gap-3 py-4 text-left font-semibold", className)}
      onClick={() => {
        if (!acc || !item) return;
        if (open) {
          if (acc.collapsible) acc.onValueChange?.("");
        } else {
          acc.onValueChange?.(item.value);
        }
      }}
      {...props}
    >
      {children}
      <span className={cn("text-muted-foreground transition", open ? "rotate-180" : "")}>⌄</span>
    </button>
  );
}

export function AccordionContent({ className, children }) {
  const acc = useContext(AccCtx);
  const item = useContext(ItemCtx);
  const open = acc?.value === item?.value;
  if (!open) return null;
  return <div className={cn("pb-4 text-sm text-muted-foreground", className)}>{children}</div>;
}

