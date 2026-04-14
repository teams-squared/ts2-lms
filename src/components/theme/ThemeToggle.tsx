"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Render a stable placeholder to avoid layout shift before mount
  if (!mounted) {
    return <div className="w-9 h-9 flex-shrink-0" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`flex-shrink-0 p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-black/5 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${className}`}
    >
      {isDark
        ? <SunIcon className="w-4 h-4" />
        : <MoonIcon className="w-4 h-4" />
      }
    </button>
  );
}
