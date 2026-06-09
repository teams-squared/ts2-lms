"use client";

import { useState } from "react";
import { SharePointFilePicker } from "./SharePointFilePicker";
import { parseLinkContent, serializeLinkContent } from "@/lib/lesson-link";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

/**
 * Content types this editor supports. A subset of LessonType — excludes QUIZ
 * (grading side-tables) and POLICY_DOC (course-bound acknowledgement pipeline),
 * which are course-only. Used by the internal-docs editor; mirrors the body
 * fields of the course ModuleManager edit modal, reusing the same SharePoint
 * picker and link-content plumbing.
 */
export type LessonContentType = "text" | "document" | "html" | "video" | "link";

interface LessonContentEditorProps {
  type: LessonContentType;
  /** Current content string (markdown, SharePoint JSON ref, or link JSON). */
  content: string;
  onChange: (next: string) => void;
}

function fileName(content: string): string {
  try {
    return (JSON.parse(content) as { fileName?: string }).fileName ?? "Selected file";
  } catch {
    return "Selected file";
  }
}

export function LessonContentEditor({ type, content, onChange }: LessonContentEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [videoSource, setVideoSource] = useState<"sharepoint" | "url">(() => {
    if (type === "video" && content) {
      try {
        const parsed = JSON.parse(content) as Partial<SharePointDocumentRef>;
        return parsed?.driveId && parsed?.itemId ? "sharepoint" : "url";
      } catch {
        return "url";
      }
    }
    return "sharepoint";
  });

  const handlePickerSelect = (ref: SharePointDocumentRef) => {
    onChange(JSON.stringify(ref));
    setPickerOpen(false);
  };

  // ── LINK ────────────────────────────────────────────────────────────────
  if (type === "link") {
    return <LinkFields content={content} onChange={onChange} />;
  }

  // ── SharePoint-backed: document / html / video(sharepoint) ───────────────
  const usePicker =
    type === "document" || type === "html" || (type === "video" && videoSource === "sharepoint");

  if (usePicker) {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1">
          {type === "video" ? "SharePoint video" : type === "html" ? "HTML file" : "Document"}
        </label>
        {type === "video" && <VideoSourceToggle value={videoSource} onChange={setVideoSource} onClear={() => onChange("")} />}
        {content ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground flex-1 truncate">{fileName(content)}</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-muted transition-colors"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-primary w-full text-center hover:bg-primary-subtle transition-colors"
          >
            Browse SharePoint…
          </button>
        )}
        <SharePointFilePicker
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={handlePickerSelect}
          mimeTypeFilter={
            type === "video"
              ? (m) => m.startsWith("video/")
              : type === "html"
                ? (m) => m === "text/html" || m.startsWith("text/html")
                : undefined
          }
          filterLabel={type === "video" ? "video files" : type === "html" ? "HTML files" : undefined}
        />
      </div>
    );
  }

  // ── text (markdown) / video(url) ─────────────────────────────────────────
  return (
    <div>
      <label className="block text-xs font-medium text-foreground-muted mb-1">
        {type === "video" ? "Video URL" : "Content (Markdown)"}
      </label>
      {type === "video" && <VideoSourceToggle value={videoSource} onChange={setVideoSource} onClear={() => onChange("")} />}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        rows={type === "text" ? 12 : 2}
        className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
        placeholder={type === "video" ? "https://www.youtube.com/embed/..." : "Markdown content…"}
      />
    </div>
  );
}

function VideoSourceToggle({
  value,
  onChange,
  onClear,
}: {
  value: "sharepoint" | "url";
  onChange: (v: "sharepoint" | "url") => void;
  onClear: () => void;
}) {
  return (
    <div className="mb-2 inline-flex rounded-lg border border-border p-0.5 text-xs">
      <button
        type="button"
        onClick={() => {
          if (value !== "sharepoint") onClear();
          onChange("sharepoint");
        }}
        className={`px-3 py-1 rounded-md transition-colors ${value === "sharepoint" ? "bg-primary text-white" : "text-foreground-muted"}`}
      >
        SharePoint
      </button>
      <button
        type="button"
        onClick={() => {
          if (value !== "url") onClear();
          onChange("url");
        }}
        className={`px-3 py-1 rounded-md transition-colors ${value === "url" ? "bg-primary text-white" : "text-foreground-muted"}`}
      >
        External URL
      </button>
    </div>
  );
}

/** URL + optional blurb fields for LINK content. Mirrors the course modal. */
function LinkFields({ content, onChange }: { content: string; onChange: (next: string) => void }) {
  const parsed = parseLinkContent(content);
  const draftUrl = parsed?.url ?? safeRaw(content, "url");
  const draftBlurb = parsed?.blurb ?? safeRaw(content, "blurb");

  function update(nextUrl: string, nextBlurb: string) {
    if (!nextUrl) {
      onChange("");
      return;
    }
    onChange(serializeLinkContent({ url: nextUrl, blurb: nextBlurb }));
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="link-url" className="block text-xs font-medium text-foreground-muted mb-1">
          Article URL <span className="text-danger">*</span>
        </label>
        <input
          id="link-url"
          type="url"
          inputMode="url"
          value={draftUrl}
          onChange={(e) => update(e.target.value.trim(), draftBlurb)}
          placeholder="https://example.com/article"
          className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="link-blurb" className="block text-xs font-medium text-foreground-muted mb-1">
          Blurb <span className="text-foreground-muted">(optional)</span>
        </label>
        <textarea
          id="link-blurb"
          value={draftBlurb}
          onChange={(e) => update(draftUrl, e.target.value)}
          rows={2}
          placeholder="One sentence describing this document."
          className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

function safeRaw(raw: string, key: "url" | "blurb"): string {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return typeof obj[key] === "string" ? (obj[key] as string) : "";
  } catch {
    return "";
  }
}
