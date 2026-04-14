"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Spinner } from "@/components/ui/Spinner";
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface LessonViewerProps {
  title: string;
  type: LessonType;
  content: string | null;
}

function PdfViewer({ proxyUrl, fileName }: { proxyUrl: string; fileName: string }) {
  // Pre-flight: fetch the file to verify it's accessible and populate the
  // browser cache (Cache-Control: private, max-age=900). The iframe then loads
  // the same URL from cache — no blob: URL needed, avoiding Chrome's
  // "Not allowed to load local resource: blob:" restriction.
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(proxyUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await res.blob(); // consume body so browser caches it for the iframe
        setReady(true);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setError(true);
      });

    return () => controller.abort();
  }, [proxyUrl]);

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#3a3a48]"
      style={{ height: "min(80vh, calc(100vh - 8rem))" }}
    >
      {!ready && !error && (
        <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-[#18181f]">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
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
              className="inline-block rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              Download {fileName}
            </a>
          </div>
        </div>
      ) : ready ? (
        <iframe
          src={proxyUrl}
          title={fileName}
          className="w-full h-full"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : null}
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
              className="shrink-0 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 transition-colors"
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
        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-brand-600 dark:prose-a:text-brand-400 prose-code:text-brand-600 dark:prose-code:text-brand-400 prose-code:bg-gray-100 dark:prose-code:bg-[#1e1e28] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-100 dark:prose-pre:bg-[#1e1e28]">
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
