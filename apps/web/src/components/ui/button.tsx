"use client";

import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600",
  secondary:
    "bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900",
  ghost:
    "bg-transparent text-slate-900 hover:bg-slate-100 focus-visible:outline-slate-400",
  outline:
    "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus-visible:outline-blue-600",
} as const;

const sizes = {
  md: "h-10 px-4 py-2 text-sm",
  sm: "h-8 px-3 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-10 w-10",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  isLoading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  isLoading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? isLoading}
      data-variant={variant}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-60",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {isLoading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
      )}
      {children}
    </button>
  );
}




