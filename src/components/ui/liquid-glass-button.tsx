"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a0f] disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 active:translate-y-[0.5px]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/30 font-semibold",
        primary:
          "bg-blue-600 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/30 font-semibold",
        secondary:
          "bg-[#141a27] text-slate-200 border border-[#232d42] hover:bg-[#1a2334] hover:text-white",
        outline:
          "border border-[#232d42] bg-transparent text-slate-300 hover:bg-[#141a27] hover:text-white",
        ghost:
          "bg-transparent text-slate-400 hover:text-white hover:bg-[#141a27]",
        destructive:
          "bg-rose-600/90 text-white hover:bg-rose-600 font-semibold shadow-sm shadow-rose-950/40",
        danger:
          "bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/40 hover:text-rose-200 font-medium",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-500 font-semibold shadow-sm shadow-emerald-950/40",
        subtle:
          "bg-[#111622] text-slate-300 border border-[#1d263a] hover:bg-[#182030] hover:text-white",
        link:
          "text-blue-400 underline-offset-4 hover:underline p-0 h-auto font-normal",
        cool:
          "bg-blue-600 text-white hover:bg-blue-500 font-semibold shadow-sm",
        liquid:
          "bg-[#141a27] text-slate-200 border border-[#232d42] hover:bg-[#1a2334] hover:text-white",
        liquidBlue:
          "bg-blue-600 text-white hover:bg-blue-500 font-semibold shadow-sm",
        liquidDark:
          "bg-[#111622] text-slate-300 border border-[#1d263a] hover:bg-[#182030] hover:text-white",
        liquidDestructive:
          "bg-rose-950/40 border border-rose-800/50 text-rose-300 hover:bg-rose-900/40",
      },
      size: {
        default: "h-8.5 px-3.5 py-1.5",
        sm: "h-7.5 px-2.5 py-1 text-xs",
        md: "h-8.5 px-3.5 py-1.5 text-xs",
        lg: "h-10 px-4 py-2 text-sm",
        icon: "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const liquidbuttonVariants = buttonVariants;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

function LiquidButton({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof liquidbuttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(liquidbuttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Button, buttonVariants, liquidbuttonVariants, LiquidButton };
