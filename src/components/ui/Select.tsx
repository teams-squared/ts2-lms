"use client";

import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", children, ...props }: Props) {
  return (
    <select
      className={`px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
