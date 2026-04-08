"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 shadow-sm",
  secondary:
    "bg-white dark:bg-[#26262e] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#3a3a48] hover:bg-gray-50 dark:hover:bg-[#2e2e3a] disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
