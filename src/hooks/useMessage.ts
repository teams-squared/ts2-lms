"use client";

import { useState, useCallback, useRef } from "react";

export type MessageState = { type: "success" | "error"; text: string } | null;

/**
 * Auto-dismissing success/error notification state.
 * Replaces the duplicated message+setTimeout pattern in RoleManager and DocProtectionPanel.
 */
export function useMessage(duration = 3000) {
  const [message, setMessage] = useState<MessageState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMessage = useCallback(
    (type: "success" | "error", text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage({ type, text });
      timerRef.current = setTimeout(() => setMessage(null), duration);
    },
    [duration]
  );

  return { message, showMessage };
}
