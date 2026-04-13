"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface LessonViewerProps {
  title: string;
  type: LessonType;
  content: string | null;
}

function PdfViewer({ proxyUrl, fileName }: { proxyUrl: string; fileName: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#3a3a48]"
      style={{ height: "80vh" }}
    >
      {!loaded && !error && (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#18181f]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading document…</p>
          </div>
        </div>
      )}
      {error ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#18181f] p-8">
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Unable to display document
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              The document could not be loaded. You can download it directly instead.
            </p>
            <a
              href={proxyUrl}
              download={fileName}
              className="inline-block rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Download {fileName}
            </a>
          </div>
        </div>
      ) : (
        <iframe
          src={proxyUrl}
          title={fileName}
          className="w-full h-full"
          style={{ display: loaded ? "block" : "none" }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </div>
  );
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
          <PdfViewer proxyUrl={proxyUrl!} fileName={docRef.fileName} />
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

  // Default: text (markdown) — also handles any other types gracefully
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
