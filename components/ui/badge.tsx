import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "outline";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-tight select-none";

  const variants = {
    default: "bg-zinc-100 text-zinc-700 border border-zinc-200/70",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
    warning: "bg-amber-50 text-amber-800 border border-amber-200/70",
    danger: "bg-rose-50 text-rose-700 border border-rose-200/70",
    outline: "text-zinc-700 border border-zinc-300 bg-white",
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    />
  );
}
