"use client";

/**
 * Theme provider — thin wrapper around `next-themes`.
 *
 * Delegates FOUC prevention, system-preference detection, and localStorage
 * persistence to `next-themes`. We expose the same `useTheme` hook shape so
 * existing consumers (ThemeToggle, etc.) continue to work unchanged.
 *
 * See design-system doc Section 11.3.
 */

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Thin re-export of next-themes' `useTheme` so call sites import from one place.
 * Returns `{ theme, setTheme, resolvedTheme, systemTheme }`.
 */
export const useTheme = useNextTheme;
