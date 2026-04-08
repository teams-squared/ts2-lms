"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`px-3 py-2 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-transparent ${className}`}
      {...props}
    />
  );
}
