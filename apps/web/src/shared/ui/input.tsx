import * as React from "react";
import { cn } from "./utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-background-soft px-3.5 text-sm text-foreground placeholder:text-muted transition-colors",
          "focus:border-primary focus:bg-surface focus:outline-none focus:ring-3 focus:ring-primary/10",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
