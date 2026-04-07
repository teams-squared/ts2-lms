"use client";

import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: Props) {
  return (
    <input
      className={`px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-transparent ${className}`}
      {...props}
    />
  );
}
