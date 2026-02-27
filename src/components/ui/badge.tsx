import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-clay-700 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-clay-700 text-cream hover:bg-clay-600",
        secondary: "border-transparent bg-clay-100 text-clay-700 hover:bg-clay-200",
        destructive: "border-transparent bg-red-500 text-white hover:bg-red-600",
        outline: "text-clay-700 border-clay-200",
        success: "border-transparent bg-green-100 text-green-800",
        warning: "border-transparent bg-yellow-100 text-yellow-800",
        gold: "border-transparent bg-gold/20 text-gold-dark",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
