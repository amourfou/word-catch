import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { WordStatus } from "@/lib/supabase";
import { STATUS_LABEL } from "@/lib/mastery";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
        unknown: "bg-unknown/15 text-unknown",
        learning: "bg-learning/20 text-learning",
        mastered: "bg-mastered/15 text-mastered",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function StatusBadge({ status }: { status: WordStatus }) {
  return <Badge variant={status}>{STATUS_LABEL[status]}</Badge>;
}
