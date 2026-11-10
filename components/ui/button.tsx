import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/20 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 select-none rounded-lg cursor-pointer";

    const variants = {
      primary:
        "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-950 shadow-xs border border-zinc-900",
      secondary:
        "bg-white text-zinc-900 hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200/90 shadow-2xs",
      outline:
        "border border-zinc-200 text-zinc-700 hover:bg-zinc-100/70 hover:text-zinc-900",
      ghost:
        "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/60",
      danger:
        "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-xs",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5 font-medium",
      md: "h-9.5 px-4 text-sm gap-2 font-medium",
      lg: "h-11 px-5 text-sm gap-2.5 font-medium",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
