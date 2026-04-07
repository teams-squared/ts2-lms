"use client";

import { useRef, useState } from "react";
import { LinkIcon } from "@/components/icons";

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy link to this page"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex-shrink-0"
    >
      <LinkIcon className="w-3.5 h-3.5" />
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
