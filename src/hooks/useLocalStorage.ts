"use client";

import { useState, useCallback } from "react";
import { getStorageItem, setStorageItem } from "@/lib/storage";

/**
 * Persistent state backed by localStorage. SSR-safe (falls back to `fallback`
 * on the server). Replaces direct localStorage calls in AppSidebar.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() =>
    getStorageItem(key, fallback)
  );

  const setValue = useCallback(
    (value: T) => {
      setStoredValue(value);
      setStorageItem(key, value);
    },
    [key]
  );

  return [storedValue, setValue];
}
