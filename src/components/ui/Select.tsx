"use client";

import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: Props) {
  return (
    <select
      className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a3a48] text-sm text-gray-900 dark:text-gray-100 outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-[#1e1e28] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
