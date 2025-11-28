import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variantClasses = {
  default: "bg-slate-900 text-white",
  success: "bg-green-100 text-green-900",
  warning: "bg-amber-100 text-amber-900",
  outline: "border border-slate-200 text-slate-700",
} as const;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variantClasses;
};

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}


