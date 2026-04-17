"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
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
      className={`flex-shrink-0 p-2.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${className}`}
    >
      {isDark
        ? <SunIcon className="w-4 h-4" />
        : <MoonIcon className="w-4 h-4" />
      }
    </button>
  );
}
