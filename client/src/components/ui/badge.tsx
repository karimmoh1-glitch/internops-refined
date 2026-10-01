import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-sm border px-1.5 py-[1px] text-[11px] font-medium leading-[18px] transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-soft text-accent",
        secondary: "border-transparent bg-surface-2 text-ink-2",
        destructive: "border-transparent bg-danger-soft text-danger",
        outline: "text-ink-2 border-line bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
