"use client";

import dynamic from "next/dynamic";
import type { Components } from "react-markdown";
import { Spinner } from "@/components/ui/Spinner";

// react-markdown + remark-gfm are only needed where authored content can carry
// formatting. Load on demand via the same lazy chunk LessonViewer uses so the
// libraries stay out of route bundles until a formatted question is rendered.
const MarkdownContent = dynamic(
  () => import("@/components/courses/MarkdownContent").then((m) => m.MarkdownContent),
  {
    ssr: false,
    loading: () => (
      <span className="inline-flex py-0.5">
        <Spinner size="sm" />
      </span>
    ),
  },
);

/** External-link hardening shared by both maps. Mirrors LessonViewer: react-
 *  markdown v10 already strips javascript:/data:/vbscript: URLs; this closes the
 *  window.opener tab-nabbing vector and leaves internal links in-tab. */
const safeLink: Components["a"] = ({ href, children }) => {
  const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
  return (
    <a
      href={href}
      className="text-primary underline transition-colors hover:text-primary-hover"
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
    >
      {children}
    </a>
  );
};

const inlineCode: Components["code"] = ({ className, children, ...props }) => {
  const isBlock = Boolean(className?.startsWith("language-"));
  if (isBlock) {
    return <code className={`${className} font-mono text-xs text-foreground`}>{children}</code>;
  }
  return (
    <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs text-primary" {...props}>
      {children}
    </code>
  );
};

/**
 * Block map — for question prompts. Compact (text-sm) and tuned to sit inside a
 * question card. Headings are downgraded to bold text since a question prompt
 * shouldn't introduce document-level headings. The trailing paragraph drops its
 * bottom margin so a single-paragraph prompt lines up tightly.
 */
const blockComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-foreground [&:not(:last-child)]:mb-2">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="my-1 list-disc space-y-0.5 pl-5 text-sm text-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 list-decimal space-y-0.5 pl-5 text-sm text-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  // Headings have no place in a question prompt — render as plain bold text.
  h1: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h2: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h3: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  h4: ({ children }) => <p className="text-sm font-semibold text-foreground">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-border pl-3 italic text-foreground-muted">
      {children}
    </blockquote>
  ),
  a: safeLink,
  code: inlineCode,
};

/**
 * Inline map — for short answer-option text. Paragraphs collapse to a fragment so
 * the rendered markdown flows inline inside its `<span>` without block spacing.
 * Bold/italic/code/links still apply; lists are styled compactly if ever used.
 */
const inlineComponents: Components = {
  p: ({ children }) => <>{children}</>,
  ul: ({ children }) => <ul className="my-0.5 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-0.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground">{children}</em>,
  a: safeLink,
  code: inlineCode,
};

/**
 * Renders admin-authored markdown for assessment question prompts and options.
 * `inline` collapses block wrapping for option text; the default block mode is
 * for prompts. Plain text passes through unchanged, so pre-markdown questions
 * keep rendering exactly as before.
 */
export function QuestionMarkdown({
  children,
  inline = false,
}: {
  children: string;
  inline?: boolean;
}) {
  return (
    <MarkdownContent components={inline ? inlineComponents : blockComponents}>
      {children}
    </MarkdownContent>
  );
}
