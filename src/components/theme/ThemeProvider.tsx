"use client";

/**
 * Theme provider — API-compatible with next-themes' `useTheme()` hook.
 *
 * Why not next-themes? next-themes injects its FOUC-prevention `<script>` via
 * React's `dangerouslySetInnerHTML` inside a component. Under React 19, that
 * triggers a dev-only "Encountered a script tag while rendering React
 * component" warning on every render. The injection is functionally fine on
 * SSR, but the noise is unacceptable.
 *
 * Instead, we put the FOUC-prevention script in `<head>` via Next's `<Script>`
 * with `strategy="beforeInteractive"` (see src/app/layout.tsx) — that runs
 * outside React's render tree. This provider then handles state sync +
 * localStorage + system-theme media-query listening.
 *
 * Design-system reference: Section 11.3.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  systemTheme: "light",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem("theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy init — matches what the FOUC script already set on <html>, so the
  // first client render doesn't disagree with SSR.
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystem());

  // Listen for OS-level theme changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  // Keep the html `.dark` class and localStorage in sync with `theme`.
  useEffect(() => {
    applyClass(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, systemTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
