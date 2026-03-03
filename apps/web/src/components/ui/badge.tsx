import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-[5px] px-2 py-[3px] text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--panel-bg)] text-[var(--text-secondary)]",
        success:
          "bg-[var(--success)]/10 text-[var(--success)]",
        warning:
          "bg-[var(--warning)]/10 text-[var(--warning)]",
        error:
          "bg-[var(--error)]/10 text-[var(--error)]",
        outline:
          "border border-[var(--border-default)] text-[var(--text-secondary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Data color attribute for user-assigned field/status colors */
  dataColor?: string
}

function Badge({ className, variant, dataColor, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...(dataColor ? { "data-color": dataColor } : {})}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
