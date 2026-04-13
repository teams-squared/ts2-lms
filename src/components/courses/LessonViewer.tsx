"use client";

import ReactMarkdown from "react-markdown";
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface LessonViewerProps {
  title: string;
  type: LessonType;
  content: string | null;
}

export function LessonViewer({ title, type, content }: LessonViewerProps) {
  if (type === "document") {
    let docRef: SharePointDocumentRef | null = null;
    if (content) {
      try {
        docRef = JSON.parse(content) as SharePointDocumentRef;
      } catch {
        docRef = null;
      }
    }

    const proxyUrl = docRef
      ? `/api/sharepoint/files/${docRef.driveId}/${docRef.itemId}`
      : null;
    const isPdf = docRef?.mimeType === "application/pdf";

    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {title}
        </h1>
        {!docRef ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No document attached.
          </p>
        ) : isPdf ? (
          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#3a3a48]" style={{ height: "80vh" }}>
            <iframe
              src={proxyUrl!}
              title={docRef.fileName}
              className="w-full h-full"
            />
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-[#3a3a48] bg-gray-50 dark:bg-[#18181f] p-6 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {docRef.fileName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {docRef.mimeType}
              </p>
            </div>
            <a
              href={proxyUrl!}
              download={docRef.fileName}
              className="shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Download
            </a>
          </div>
        )}
      </div>
    );
  }

  if (type === "video") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {title}
        </h1>
        {content ? (
          <div className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe
              src={content}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="aspect-video rounded-xl bg-gray-100 dark:bg-[#18181f] flex items-center justify-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No video URL provided.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (type === "quiz") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {title}
        </h1>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-8 text-center">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Quiz functionality coming soon.
          </p>
        </div>
      </div>
    );
  }

  // Default: text (markdown)
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {title}
      </h1>
      {content ? (
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:bg-gray-100 dark:prose-code:bg-[#1e1e28] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 dark:prose-pre:bg-[#1e1e28]">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No content yet.
        </p>
      )}
    </div>
  );
}
