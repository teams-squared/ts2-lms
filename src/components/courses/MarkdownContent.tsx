"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown renderer bundling react-markdown + remark-gfm in one chunk.
 * LessonViewer lazy-imports this so both libraries stay out of the main
 * bundle and load only for TEXT lessons / internal docs. remark-gfm is what
 * enables tables, strikethrough, autolinks, and task lists — without it
 * react-markdown's core parser emits no table nodes and pipes render raw.
 */
export function MarkdownContent({
  components,
  children,
}: {
  components: Components;
  children: string;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}
