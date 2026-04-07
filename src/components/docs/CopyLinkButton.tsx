"use client";

import { LinkIcon } from "@/components/icons";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

export default function CopyLinkButton() {
  const { copied, copy } = useCopyToClipboard(2000);

  return (
    <button
      onClick={() => copy(window.location.href)}
      title="Copy link to this page"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors flex-shrink-0"
    >
      <LinkIcon className="w-3.5 h-3.5" />
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}
