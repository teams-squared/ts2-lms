"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { Spinner } from "@/components/ui/Spinner";
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

/** Explicit Tailwind styling for every markdown element — no typography plugin needed. */
const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-2 text-gray-900 dark:text-gray-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">{children}</h3>,
  h4: ({ children }) => <h4 className="text-sm font-semibold mt-4 mb-1 text-gray-900 dark:text-gray-100">{children}</h4>,
  p:  ({ children }) => <p className="mb-4 text-gray-700 dark:text-gray-300 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700 dark:text-gray-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-gray-700 dark:text-gray-300">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-brand-400 pl-4 italic text-gray-600 dark:text-gray-400 my-4">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-gray-200 dark:border-[#2e2e3a] my-6" />,
  strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
  em: ({ children }) => <em className="italic text-gray-700 dark:text-gray-300">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="bg-gray-100 dark:bg-[#1e1e28] border border-gray-200 dark:border-[#2e2e3a] rounded-lg p-4 overflow-x-auto mb-4 text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    // Fenced code blocks have a language-* className; inline code does not
    const isBlock = Boolean(className?.startsWith("language-"));
    if (isBlock) {
      return <code className={`${className} font-mono text-sm text-gray-800 dark:text-gray-200`}>{children}</code>;
    }
    return (
      <code className="bg-gray-100 dark:bg-[#1e1e28] text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-[#2e2e3a] text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-gray-50 dark:bg-[#18181f]">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-[#2e2e3a]">{children}</td>,
};

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
      style={{ height: "calc(100vh - 16rem)" }}
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
        <div className="max-w-none text-sm">
          <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No content yet.
        </p>
      )}
    </div>
  );
}
