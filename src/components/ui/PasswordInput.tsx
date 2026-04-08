"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className={`w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-[#3a3a48] bg-white dark:bg-[#1e1e28] text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-colors focus:ring-2 focus:ring-brand-500 focus:border-transparent ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? (
          <EyeOffIcon className="w-4 h-4" />
        ) : (
          <EyeIcon className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
