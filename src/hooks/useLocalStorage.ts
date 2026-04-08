"use client";

import { useState, useEffect, useCallback } from "react";
import { getStorageItem, setStorageItem } from "@/lib/storage";

/**
 * Persistent state backed by localStorage. SSR-safe: always initialises with
 * `fallback` so the server render and the client's first (hydration) render
 * agree. The real localStorage value is applied in a useEffect after mount,
 * avoiding hydration mismatches entirely.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T
): [T, (value: T) => void] {
  // Always start with the fallback so SSR and the initial client render match.
  const [storedValue, setStoredValue] = useState<T>(fallback);

  // After mount, hydrate from localStorage (runs only on the client).
  useEffect(() => {
    const stored = getStorageItem(key, fallback);
    setStoredValue(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value);
      setStorageItem(key, value);
    },
    [key]
  );

  return [storedValue, setValue];
}
