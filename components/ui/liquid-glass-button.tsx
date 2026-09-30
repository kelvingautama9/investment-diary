"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-blue-600 text-white shadow-md shadow-blue-600/30 hover:bg-blue-500 hover:shadow-blue-500/40",
        destructive:
          "bg-rose-600 text-white shadow-md shadow-rose-600/30 hover:bg-rose-500",
        cool:
          "bg-gradient-to-t from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/25 border border-white/20 hover:brightness-110 active:brightness-95",
        liquid:
          "relative overflow-hidden bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md border border-white/20 text-white shadow-[0_4px_20px_rgba(0,0,0,0.25),inset_0_1px_1.5px_rgba(255,255,255,0.4)] hover:border-white/35 hover:shadow-[0_6px_25px_rgba(255,255,255,0.18)]",
        liquidBlue:
          "relative overflow-hidden bg-blue-600/35 hover:bg-blue-600/50 backdrop-blur-md border border-blue-400/40 text-white shadow-[0_4px_20px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.5)] hover:border-blue-400/60 hover:shadow-[0_6px_25px_rgba(59,130,246,0.5)]",
        liquidDark:
          "relative overflow-hidden bg-[#0e1424]/80 hover:bg-[#141c32] backdrop-blur-md border border-[#222c44] text-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.1)] hover:text-white hover:border-[#2f3d5e]",
        liquidDestructive:
          "relative overflow-hidden bg-rose-600/25 hover:bg-rose-600/40 backdrop-blur-md border border-rose-400/35 text-rose-100 shadow-[0_4px_20px_rgba(225,29,72,0.3),inset_0_1px_1.5px_rgba(255,255,255,0.3)] hover:border-rose-400/50",
        outline:
          "border border-slate-700 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white hover:border-slate-600",
        secondary:
          "bg-slate-800/60 hover:bg-slate-800 text-slate-200 border border-slate-700/60",
        ghost:
          "hover:bg-white/10 text-slate-300 hover:text-white",
        link:
          "text-blue-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-xl px-6 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

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

const liquidbuttonVariants = cva(
  "inline-flex items-center transition-all justify-center cursor-pointer gap-2 whitespace-nowrap rounded-xl text-xs font-semibold transition-[color,box-shadow,transform,background-color] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-white/[0.09] hover:bg-white/[0.16] text-white backdrop-blur-md border border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1.5px_rgba(255,255,255,0.4)] hover:shadow-[0_6px_22px_rgba(255,255,255,0.18)] hover:border-white/30",
        primary:
          "bg-blue-600/35 hover:bg-blue-600/50 text-white backdrop-blur-md border border-blue-400/40 shadow-[0_4px_20px_rgba(37,99,235,0.35),inset_0_1px_2px_rgba(255,255,255,0.6)] hover:shadow-[0_6px_25px_rgba(59,130,246,0.5)] hover:border-blue-400/60",
        destructive:
          "bg-rose-600/30 hover:bg-rose-600/45 text-rose-100 backdrop-blur-md border border-rose-400/40 shadow-[0_4px_20px_rgba(225,29,72,0.3),inset_0_1px_1.5px_rgba(255,255,255,0.4)] hover:border-rose-400/60",
        secondary:
          "bg-[#0e1424]/80 hover:bg-[#141c32] text-slate-200 backdrop-blur-md border border-[#222c44] shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:text-white hover:border-[#2f3d5e]",
        ghost:
          "hover:bg-white/10 text-slate-300 hover:text-white backdrop-blur-sm",
      },
      size: {
        default: "h-9 px-4 py-2 text-xs",
        sm: "h-8 text-xs gap-1.5 px-3 rounded-lg",
        md: "h-9 text-xs gap-2 px-4 rounded-xl",
        lg: "h-10 text-sm px-6 rounded-xl",
        xl: "h-12 text-sm px-8 rounded-2xl",
        xxl: "h-14 text-base px-10 rounded-2xl",
        icon: "size-9 p-0 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

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
    <>
      <Comp
        data-slot="button"
        className={cn(
          "relative overflow-hidden group select-none",
          liquidbuttonVariants({ variant, size, className })
        )}
        {...props}
      >
        {/* Liquid Glass Highlight & Inner Reflection Bevel */}
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]
            shadow-[0_0_8px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_2px_2px_0.5px_-2px_rgba(255,255,255,0.25),inset_-2px_-2px_0.5px_-2px_rgba(0,0,0,0.5),inset_1px_1px_1px_-0.5px_rgba(255,255,255,0.5),inset_0_0_8px_4px_rgba(255,255,255,0.04)]
            transition-all duration-300 group-hover:inset-0"
        />

        {/* Backdrop Glass Layer */}
        <div
          className="pointer-events-none absolute inset-0 isolate -z-10 h-full w-full overflow-hidden rounded-[inherit]"
          style={{ backdropFilter: 'url("#container-glass")' }}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </div>
        <GlassFilter />
      </Comp>
    </>
  );
}

function GlassFilter() {
  return (
    <svg className="absolute w-0 h-0 pointer-events-none opacity-0" aria-hidden="true">
      <defs>
        <filter
          id="container-glass"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05 0.05"
            numOctaves="1"
            seed="1"
            result="turbulence"
          />
          <feGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurredNoise"
            scale="40"
            xChannelSelector="R"
            yChannelSelector="B"
            result="displaced"
          />
          <feGaussianBlur in="displaced" stdDeviation="3" result="finalBlur" />
          <feComposite in="finalBlur" in2="finalBlur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

export { Button, buttonVariants, liquidbuttonVariants, LiquidButton };
