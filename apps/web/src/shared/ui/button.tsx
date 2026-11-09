import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "bg-transparent text-mid border-[1.5px] border-border hover:border-primary hover:text-primary",
        ghost: "bg-transparent text-mid hover:bg-background-soft",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        default: "h-11 px-6",
        // ФБШ-10: хүрэх элемент 44 px-ээс багагүй (жижиг товч ч).
        sm: "h-11 px-4 text-xs",
        lg: "h-13 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
