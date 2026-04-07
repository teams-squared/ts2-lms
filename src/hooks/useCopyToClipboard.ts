"use client";

import { useState, useRef, useCallback } from "react";

/**
 * Copies text to the clipboard and exposes a `copied` boolean that resets
 * after `duration` ms. Replaces the inline pattern in CopyLinkButton.
 */
export function useCopyToClipboard(duration = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), duration);
    },
    [duration]
  );

  return { copied, copy };
}
